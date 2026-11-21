# 发型图片任务

每次先填完真实条件和参考职责，再调用当前内置工具。下列字段是写给模型的自然语言，不是工具参数。模板不保证像素级保真，必须检查结果。

## 轮廓观察进入方案

先依据真实原照形成 [contour-personalization.md](contour-personalization.md) 所述观察与设计目标，再写每款的个人依据。可用 `scripts/compile_personalized_round.py` 输出完整独立提示词。提示词明确：通过头发高度、两侧重量、刘海方向和边缘来实现设计，保持真实脸部几何，不能把“希望视觉更平衡”执行成瘦脸或缩短脸。脸型名称只是照片印象，不作为重画本人指令。每款写结构差别与需核对区域；编译通过不证明实际图像够有型。

## 本人基准肖像与独立方案

标准流程先编辑真实原照：保留本人五官、脸型、年龄、眼镜、发型与衣服，去掉原背景并换成干净浅色，统一画幅。按用户对本工作流的要求，拍摄不理想时自然整理曝光、色偏、重阴影和临时皮肤瑕疵；保留真实肤色与皮肤纹理，不改脸部几何，顾客要求无修饰时遵守。照片严重模糊或五官遮挡时补素材，不凭空生成真实细节。完整边界见 [photo-quality-and-layout.md](photo-quality-and-layout.md)。标为 AI 处理基准，原照仍是身份依据；不把模型生成成功当作本人已确认。

可直接写入基准任务的自然优化约束：

```text
Naturally improve the presentation of this same person when the source photo has poor lighting: gently correct exposure and color cast, soften harsh cast shadows and reduce temporary skin blemishes while retaining skin texture and the person's actual skin tone, age, facial hair and distinctive traits. Preserve actual face width, jaw/chin, eye shape and spacing, nose, lips, expression and glasses. Do not slim or reshape the face, enlarge eyes, lower the hairline, add makeup or create a replacement model portrait. Keep the source view; do not invent a more flattering new camera angle. If critical identity detail is not visible, do not fabricate a faithful reconstruction. Apply this natural optimization ONCE in the baseline. All subsequent hairstyles must retain this same facial appearance and lighting without additional retouching.
```

随后每款分别编辑同一基准，同时引用真实原照核对本人。提示词须写明基准负责画面与保留的人物外观、真实原照负责身份交叉核对；只更改本款头发，不重新美颜，不用上一款连环编辑。每款输出一张单人单角度图，统一干净背景、构图与衣服；编号与 AI 预览标签简短。默认 12 款，基准不计入数量。

## 快速模式的可选四格图

```text
Use case: identity-preserve
Asset type: customer haircut comparison, AI preview
Task: edit the supplied REAL front photo into one comparison image with [数量] clearly different haircut options. For four options use equal 2-by-2 panels. This is a local photographic hair edit.

Input 1 is the customer's real front photograph, the authoritative identity and edit target. [Only if supplied: Input 2 is a hairstyle reference only; never borrow its face, skin, skull shape or clothing.]

Preserve the real person's face width, jaw/chin, cheekbones, eye shape and spacing, nose, lips, age, skin tone, skin texture, facial asymmetry, facial hair, glasses geometry and reflections, expression, ears, neck, clothing, pose and camera angle. No face slimming, enlarged eyes, skin smoothing, whitening, makeup or new portrait lighting. Do not manufacture a prettier replacement person.

Change only scalp hair structure and necessary hair occlusion boundaries. Preserve original hair color and native curl. Keep plausible density and skull size. Keep the original background and facial lighting; use identical head size, crop and exposure across options. Show the entire hair silhouette. If the customer explicitly chose a neutral background, apply only that requested background change without relighting the face.

Options, left-to-right then top-to-bottom:
[For every option give ID + Chinese short name, length, fringe coverage, parting, sides, top volume, native texture, visible ear/nape details, and any grow-out/service condition.]

Customer constraints: [confirmed keep/avoid, acceptable length and permitted visual exploration]. Do not add dye, bleach, perm, hair extensions or unapproved major shortening. Hidden newly exposed hairline or ear-back areas are speculative and require checking.

Use narrow neutral gutters and short ID captions. No report, diagnosis, ratings, prices, sales copy or extra faces. Add the small literal label “AI效果预览”. A haircut should differ through observable structure, never through a changed face or filter. Output one comparison image.
```

若标签出现错字或款式未实现，在图外给出正确映射和问题；不为文字重新生成整套人脸。无可用选项时如实报告，不把失败图包装成可选结果。

## 选定款微调

```text
Use case: identity-preserve
Task: compare [2 or 3] variants of the customer's selected haircut, changing ONLY [fringe length / side thickness / hair color / curl texture]. Output one comparison image.

Input 1: the customer's REAL front photo; authoritative person and identity reference.
Input 2: the accepted haircut reference [option ID, exact position if a sheet]; use ONLY that option's haircut design, never its face as a replacement identity. Ignore other panels.

Shared haircut specification: [repeat full selected length, fringe, parting, sides, top, native texture and color].
Variants: [stable IDs such as B1, B2, B3, each with one controlled change].

Preserve the real facial geometry, age, expression, skin tone/texture, eyes, nose, mouth, glasses, ears, facial hair, clothing, original camera, crop, lighting and background. No beautification or global color grade. Keep all unrequested haircut properties unchanged. Use realistic strands and density. No invented skull or hairline. Label “AI效果预览”; short option captions only.
```

颜色比较所有选项共用同一剪裁、纹理和光照；不黑→棕→灰连环修改。卷度比较不偷偷剪短、接长或把原生卷画成直发。每一调用都保留真实原照职责。

## 最终单款

```text
Use case: identity-preserve
Task: make ONE single-person, single-view AI haircut preview of the customer's selected option [ID].
Input 1 is the REAL customer front photo and the edit target, authoritative for identity, expression, face geometry, skin, glasses, clothing, camera, lighting and background.
Input 2 is the selected hairstyle design reference [exact option/position]; use that haircut only. Do not average panels or copy a generated replacement face.

Selected design: [complete haircut specification and all confirmed refinements].
Allowed change: scalp hair [and explicitly requested color/texture] plus necessary occlusion edges only. Preserve all actual facial characteristics and non-hair details. No slimming, smoothing, whitening, new makeup, artificial hair density or new photography setup.

Show the whole hair silhouette in the original view. No collage, new view, poster, rating, price or diagnostic text. Small label “AI效果预览”.
```

最终单款生成后仍需目检与本人确认。不得把顾客选中某个发型编号等同于确认后来生成的最终人脸。
