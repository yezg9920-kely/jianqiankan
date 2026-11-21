# 案例与迁移字段

照片与结果放案例私有目录的 assets/，提示词放 prompts/，case.json 只引用本案例内的相对路径。保留原文件、SHA-256 与版本。禁止把顾客照片打进技能安装包。

建议阶段：awaiting_photo → ready → generating → awaiting_choice → refining（可选）→ awaiting_final_confirmation → complete。缺工具、缺照片、失败分别写 blocked_tool_unavailable、blocked_missing_input、failed，补充原因。

## assets

真实原照至少有一个 `kind=original, view=front` 记录。最终选定文件必须是单人单角度图，不用四格图冒充单款。每项示例：

```json
{
  "id": "随机资源ID",
  "kind": "generated",
  "view": "front",
  "layout": "single",
  "option_id": "B2",
  "path": "assets/final-v1.png",
  "sha256": "文件实际SHA256",
  "review": {
    "visual": "accepted",
    "identity": "customer_confirmed"
  }
}
```

原照无需 option_id、layout 或 review；generated 的初始 review 应是 pending，不照抄示例中的通过状态。对比图用 layout=comparison_sheet，在该图片记录中保存 panel_reviews，避免把其中一格通过推广为整图通过。

## options 和 runs

options 每项包含唯一 id、name、spec（结构完整描述）、difference、service_conditions、unknowns。微调后使用 B1/B2 等新编号，保留 parent_option_id；不要把旧 B 的定义静默改掉。

推荐轮次在 recommendation_round 中递增，options 每项带 round_id。标准批次用 01–12 等展示编号，并保留轮次前缀，避免与旧 A–D 混淆。feedback_history 记录顾客原话、对应轮次、被排除的结构和下一轮调整。preferences.style_direction 是男生发型、女生发型或中性发型的目录，style_direction_source 写 photo_style_inference 或 user_provided；不把目录推断记成顾客性别事实。

生成基准用独立资产 role=generated-baseline、kind=generated、is_real_photo=false；它不取代 original 正面照。用户未确认时保留 pending_customer。每款方案记录其基准资产和真实原照引用，不能在记录里把生成基准写成真实原图。

runs 每次工具调用一条：id、stage、attempt、prompt_path、references（有序 asset_id 与职责）、started_at、finished_at、status、output_asset_ids、failure_reason、model_id、usage、cost。不可见字段为 null。失败调用也计入默认三次上限；只准备提示词但未调用不计。软件记录不能替代真实工具回执。

selection 保存顾客原话、明确 option_id、最终单款 asset_id。customer_confirmed 只在顾客确认最终结果后为 true。asset 的 option_id 必须一致。

feasibility.status 是 unreviewed、needs_more_info 或 stylist_confirmed。它与顾客视觉选择互相独立。communication 中只写已明确的沟通内容，空值会显示“待现场确认”。

## 沟通卡

在技能目录运行或使用脚本绝对路径：

```sh
python3 scripts/render_card.py /案例绝对路径/case.json
```

默认输出到案例 reports/ 下的新 HTML，内嵌原始图片字节，直接在浏览器查看或打印。它不是新生图，不重新绘制人脸。所有输入必须在案例目录内且 hash 匹配；本人尚未确认、单款/编号不对应或视觉未通过时脚本会拒绝生成正式卡。

## 后续平台映射

| Codex 阶段 | 扣子后续节点职责 | 工作台后续界面 |
| --- | --- | --- |
| 照片与约束 | 输入与检查 | 顾客案例/照片 |
| options 规划 | 文本规划 | 候选参数 |
| 图片工具调用 | 经单独授权的正式图片服务 | 生成任务 |
| awaiting_choice | 中断并接收编号 | 选择/反馈 |
| refining | 带原照与已选结构的图片编辑 | 微调对比 |
| 最终确认与排版 | 汇总与模板输出 | 沟通卡/历史 |

此表用于未来跨平台迁移。Mac／Windows 本机版已具备自动生成和历史回看，见 [工作台使用与任务接力](workbench.md)；没有部署扣子节点。内置 Codex 生图经过单独调用，Python 排版脚本不能调用它。跨平台后需单独确定服务与测试用量，重新验证效果。
