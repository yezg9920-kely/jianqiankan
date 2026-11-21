import Foundation
import ImageIO
import Vision

struct Observation: Codable {
    let status: String
    let advice: String
    let vertical: String?
    let jaw: String?
}

func retake(_ advice: String) -> Observation {
    Observation(status: "retake", advice: advice, vertical: nil, jaw: nil)
}

func analyze(_ path: String) throws -> Observation {
    let url = URL(fileURLWithPath: path) as CFURL
    let options = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: 1400,
    ] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else {
        return retake("这张照片无法读取，请换用清晰的正面照片。")
    }
    let request = VNDetectFaceLandmarksRequest()
    try VNImageRequestHandler(cgImage: image).perform([request])
    let faces = request.results ?? []
    guard faces.count == 1, let face = faces.first else {
        return retake(faces.isEmpty ? "未识别到清楚的脸部，请换一张平视正面照。" : "画面里有多张脸，请使用单人的正面照片。")
    }
    let box = face.boundingBox
    guard box.width * CGFloat(image.width) >= 120,
          box.height * CGFloat(image.height) >= 120,
          box.minX > 0.015, box.maxX < 0.985, box.minY > 0.015, box.maxY < 0.985,
          abs(face.yaw?.doubleValue ?? 0) < 0.38,
          abs(face.roll?.doubleValue ?? 0) < 0.24,
          let points = face.landmarks?.faceContour?.normalizedPoints,
          points.count >= 8 else {
        return retake("这张照片的脸部偏小、明显侧转或裁切较紧。建议平视镜头，让头顶、双耳和下巴都入镜。")
    }

    // Only compare regions actually returned for this view. A detector box
    // has padding and is not an estimate of the visible face shape.
    let bottom = points.map { $0.y }.min()!
    let top = points.map { $0.y }.max()!
    let span = top - bottom
    func width(at height: CGFloat) -> CGFloat? {
        let intersections = zip(points, points.dropFirst()).compactMap { (a, b) -> CGFloat? in
            let lo = min(a.y, b.y), hi = max(a.y, b.y)
            guard lo <= height, height < hi, hi - lo > 0.0001 else { return nil }
            return a.x + (height - a.y) / (b.y - a.y) * (b.x - a.x)
        }
        guard intersections.count == 2, let minX = intersections.min(), let maxX = intersections.max() else { return nil }
        return maxX - minX
    }
    let wide = points.map { $0.x }.max()! - points.map { $0.x }.min()!
    let eyeYs = ((face.landmarks?.leftEye?.normalizedPoints ?? []) +
                 (face.landmarks?.rightEye?.normalizedPoints ?? [])).map { $0.y }
    let vertical: String?
    if eyeYs.count > 5 && wide > 0.2 {
        let midY = eyeYs.reduce(0, +) / CGFloat(eyeYs.count)
        let ratio = (midY - bottom) * box.height * CGFloat(image.height) / (wide * box.width * CGFloat(image.width))
        vertical = ratio > 0.87 ? "longer" : (ratio < 0.65 ? "wider" : "balanced")
    } else {
        vertical = nil
    }
    var jaw = "unknown"
    if span > 0.2, let lower = width(at: bottom + span * 0.35), let upper = width(at: bottom + span * 0.77), upper > 0.2 {
        jaw = lower / upper < 0.85 ? "tapered" : "soft"
    }
    return Observation(status: "ready", advice: "当前正面照可以用于观察可见轮廓。试剪前还要核实发旋、原生纹理和头发的实际落点。", vertical: vertical, jaw: jaw)
}

do {
    guard CommandLine.arguments.count == 2 else { exit(2) }
    let result = try analyze(CommandLine.arguments[1])
    let data = try JSONEncoder().encode(result)
    FileHandle.standardOutput.write(data)
} catch {
    fputs("Vision analysis failed\n", stderr)
    exit(1)
}
