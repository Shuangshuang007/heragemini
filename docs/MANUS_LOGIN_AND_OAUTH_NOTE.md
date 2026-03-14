# Manus → Hera 登录方案与后续 OAuth 意向

## 当前方案：Magic link + 长期 session（折中）

- **Magic link**：Manus 调 `generate_magic_link(user_email)`，Hera 返回带短期 token（如 15 分钟）的 URL；用户点击后 Hera 校验 token，通过 NextAuth Credentials 建立 session。
- **长期 session**：Hera 使用 NextAuth，session 已配置为 **30 天**（`session.maxAge: 30 * 24 * 60 * 60`）。用户首次通过 magic link 登录后，获得 30 天的 session cookie；之后直接访问 heraai.net.au/applications 等页面，只要 cookie 未过期即自动登录，**无需每次回 Manus 重新生成链接**。只有 cookie 过期或换设备时才需再走一次 magic link。
- 因此：Magic link 仅用于**首次建立 session**，之后体验接近持久登录，与 Manus 提出的折中方案一致。

## Magic link 的局限（为何考虑 OAuth）

- 每次新链接的 token 短期过期；若用户误点旧链接或刷新带 token 的 URL 可能失效，需回 Manus 再拿新链接（首次登录后正常用 Hera 则无此问题）。
- 依赖 Hera 自建 token 校验与 Credentials provider，与「平台级联合登录」相比不够标准。

## 后续意向：与 Manus 争取联合登录（OAuth）

- **目标**：争取 Manus 平台提供 **OAuth / 联合登录** 权限，使 Hera 可作为 OAuth Client，用户从 Manus 跳转 Hera 时走标准 OAuth 流程，体验更统一、可维护性更好。
- **记录**：后续与 Manus 沟通时，明确请求「联合登录 / OAuth 集成」能力，作为长期方案；当前 magic link + 长期 session 可作为过渡，上线后若 Manus 支持 OAuth，再迁移即可。

---

*本文档仅记录方案与产品意向，不涉及实现细节。*
