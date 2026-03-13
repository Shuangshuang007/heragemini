# 开始申请前基本问题清单（供 Manus 一次性收集后复用到所有职位）

在 bulk apply 开始前，Manus 可统一向用户收集以下信息，收集一次后复用到本批所有职位申请，减少重复询问。

---

## 一、建议收集的字段

| 字段 | 说明 | 示例 / 选项 |
|------|------|-------------|
| **简历** | 优先用 Hera tailor_resume（按 JD 定制）；失败/超时则用户上传的原始简历；最后才用 Manus 内置生成。 | 见 prepare_application_context 返回的 resume_url |
| **Work rights / 工作权利** | 在目标国家/地区的合法工作权限 | e.g. Citizen / PR / Work visa / Require sponsorship |
| **Sponsorship 是否需要担保** | 当前或未来是否需要雇主担保 | Yes / No / Not sure |
| **可工作地点** | 是否仅限远程 / 仅限某城市 / 可 relocate | Remote only / Onsite (city) / Open to relocate |
| **手机号** | 部分申请表单必填 | +61 xxx xxx xxx |
| **LinkedIn URL** | 部分职位要求 | https://linkedin.com/in/... |
| **当前公司是否可联系** | 是否允许联系当前雇主做 reference | Yes / No / Only after offer |
| **期望薪资（可选）** | 部分表单会问 | 可填范围或 "Prefer to discuss" |
| **可开始日期** | 最早可入职日 | e.g. 2 weeks notice / Immediate |

---

## 二、使用方式

- Manus 在用户确认 bulk apply、且至少已有一轮推荐 + 简历后，**一次性**问上述问题（或其中与目标职位相关的子集）。
- 将答案复用到本批所有 prepare_application_context / 投递任务，无需每个职位再问一遍。
- 若某职位表单有额外必填项（如 security clearance、特定证书），可在该职位单独补问。

---

## 三、与 Hera 的衔接

- **简历**：由 prepare_application_context 返回的 `resume_url` 提供（Hera 侧已 tailor 或用户已上传）；若为 null，Manus 再引导用户上传或使用 Manus 内置生成。
- 其余问题由 Manus 收集并保存在会话/上下文中，填表时按需填入，Hera 不存储这些答案；若未来 Hera 提供「用户偏好」接口，可再对齐存储与回填。
