# Applications 页面数据与 Manus 来源对照

## 一、Applications 页面用到的数据

数据来源：**GET /api/applications?email=** → 返回 `profile.applications[]` + `userProfile`（含 jobSearches、resumes）。

每条 **application** 的字段（后端 profile.applications 与 API 返回一致）：

| 字段 | 含义 | 页面上是否展示 |
|------|------|----------------|
| jobId | 职位 ID | 用于匹配/展示 |
| jobSave | { title, company } 职位摘要 | 卡片标题、公司 |
| resumeTailor | 定制简历（下载链接等） | 有「Tailor Resume」/ 查看简历 |
| coverLetter | 求职信 | 有封面信时展示/下载 |
| applicationStatus | 申请状态（not-applied / applied / interviewing / rejected / accepted） | 下拉选择器 |
| appliedVia | 通过谁完成投递（manus / hera_web） | **当前前端未展示**（仅后端已有） |
| createdAt / updatedAt | 时间 | 列表/排序用 |

另外页面还会用 **userProfile.jobSearches**（历史搜索）、**localStorage 的 savedJobs**（与 MongoDB 的 applications 可能部分重叠）。

---

## 二、哪些能来自 Manus

| 字段/数据 | 能否来自 Manus | 说明 |
|-----------|----------------|------|
| **applicationStatus** | ✅ 能 | Manus 投递完成后调 **record_apply_result**，传入 status（如 submitted/failed），我们会写成 applicationStatus，主站 Applications 页的下拉会看到。 |
| **appliedVia** | ✅ 能 | 同上，record_apply_result 传入 channel: 'manus'，我们写成 appliedVia: 'manus'。后端已支持，前端目前未在页面上展示该字段。 |
| **整条 application 记录** | ✅ 能 | 若该 job 之前主站没存过，Manus 第一次调 record_apply_result 时，upsertJobApplication 会**新建**一条 application（jobId + applicationStatus + appliedVia）；之后列表里就会出现这条，主站和 Manus 共用同一份 applications。 |
| **jobSave** (title, company) | ⚠️ 目前不能 | 主站「保存职位」时写。若实现 **record_application_preparation**，Manus 在用户选职位准备申请时也可写 jobSave。 |
| **resumeTailor** | ✅ 能 | Manus 调 MCP **tailor_resume**（带 user_email + job_id）时，结果会写入该条 application 的 resumeTailor，和主站 Tailor 同源。 |
| **coverLetter** | ❌ 目前不能 | 仅主站生成/上传，Manus 暂无写入入口。 |
| **jobSearches** | ❌ 目前不能 | 主站搜索时 record-job-search 会写；MCP recommend_jobs 若在内部加 addJobSearchToProfile，将来也可来自 Manus。 |

---

## 三、小结：当前「来自 Manus」在 Applications 页的体现

- **已经能来自 Manus 的**  
  - **applicationStatus**：Manus 调 record_apply_result 后，该条申请的状态会更新，页面上状态下拉会反映出来。  
  - **appliedVia**：同一调用会写入 appliedVia=manus，后端和 API 已返回，只是**页面上还没展示**「通过谁投递」。  
  - **resumeTailor**：Manus 通过 tailor_resume 写入的定制简历，和主站一样会在卡片上显示/下载。  
  - **新记录**：Manus 对某个 job 第一次报 record_apply_result 时，会在 applications 里新增一条，列表里会出现这条申请。

- **若要在页面上完全体现 Manus**  
  - 在 Applications 页（或卡片）上增加 **appliedVia** 的展示（例如标签「通过 Manus 投递」/「通过主站投递」），即可一眼区分哪些是 Manus 来的。

- **当前未来自 Manus 的**  
  - jobSearches（历史搜索）、coverLetter；jobSave 目前只有主站写，若要做「Manus 选职位也记一条」需 record_application_preparation。
