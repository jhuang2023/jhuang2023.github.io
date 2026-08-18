# 迁移 InscribeDeeper.github.io 框架 → jhuang2023.github.io（学术简历站点）

## 背景

`jhuang2023.github.io` 目前把旧的 Hugo/Wowchemy 站点的**构建产物**放在 `legacy/` 目录下（已经是渲染后的静态 HTML/XML，没有 markdown 源文件），另外根目录下有最新的 `CV_HJJ_Aug2026.pdf`。`InscribeDeeper.github.io` 是给 Wei Yang 做的 Jekyll 站点（基于 sproogen 的 `modern-resume-theme` 深度定制），采用数据驱动的内容模型（`_data/profile.yml` + `_data/profile_zh.yml` + `_data/landing.yml` + `_data/ui.yml`），有一个 landing 首页做 profile 选择入口，以及多个"视图"（`niw`/`resume`/`cv`/`all`），全部由同一份 section 内容库通过 `_includes/profile-sections.html` 渲染出来。

目标：复用这套 Jekyll 框架/机制给 Jujun Huang 建站，把 Wei Yang 的个人内容全部替换成 Jujun 的，内容来源为 `legacy/`（老的 bio/研究/教学/服务文案）以及最新、最权威的 `CV_HJJ_Aug2026.pdf`（2026年8月版）。迁移完的文件里必须彻底删除 Wei Yang 的任何痕迹（姓名、邮箱、雇主、社交链接、简历 PDF、技术栈 bio、行业项目数据等）。

**已经和用户确认的决定：**
1. 完整保留三套视图 —— `cv`（完整学术 CV）、`resume`（精简版重点摘要）、`all`（全部内容，不去重）—— 以及 landing 选择入口页。完全去掉 `niw` 视图（那是 Wei Yang 的 EB-2 移民专用材料，跟学术教授完全无关）。
2. 保留中英双语基础设施，并把新的学术内容也翻译成中文（`profile_zh.yml`，以及 `ui.yml`/`landing.yml` 里跟内容相关的少数字符串）。
3. 头像先沿用 legacy 里的老照片 `legacy/authors/admin/J Huang.jpg`。

## 框架工作原理（已通过阅读模板代码确认）

- `_data/profile.yml`：`person`（姓名/职称/单位/邮箱/社交账号）、`about`（简介文字+照片——只有当某个视图设置 `show_about: true` 时才会渲染）、`views`（每个视图包含 title、可选的 `header_title`、`show_about`、`show_profile_image`、可选的 `downloads`【CV 下载按钮】，以及一个有序的 `sections` 列表，列出该视图要展示的 section id）、`sections`（一个平铺的字典；每一项有 `group`——同一视图内去重用，`tags`——仅作文档说明，模板不读取它，还有 `title`、`layout: text|list`、`content`）。
- `_includes/profile-sections.html` 渲染某个视图时：遍历 `view.sections`，按 `group` 去重（同组内第一个出现的生效），除非该视图设置了 `show_all_sections`（`all` 视图就是这样——不去重，全部渲染，并标注每个 section 被哪些视图引用）。
- `_includes/header.html` 渲染姓名/职称（有个特殊逻辑：如果 `title` 里包含 `company` 字符串，`company` 部分会自动变成可点击链接）、打印/下载按钮（数据来自 `view.downloads`）、以及社交图标——原生支持 github/linkedin/email/phone/website，另外可以通过 `site.additional_links`（任意的 icon+url+title）加别的图标。**Google Scholar 和 SSRN 目前没有原生支持**——我打算通过 `_config.yml` 里的 `additional_links` 加上，用 academicons 图标（`ai ai-google-scholar`、`ai ai-ssrn`），这需要在 `_includes/head.html` 里加一行 academicons 的 CDN 链接（跟老 Hugo 站点用的是同一个 CDN，已验证可用）。
- `_layouts/landing.html`（根目录 `/`）显示 profile 选择卡片 + 两条时间线预览，数据来自 `_data/landing.yml` 的 `career` 和 `projects`（各自有 en/zh 数组），文案标签来自 `_data/ui.yml`。
- `_includes/about.html` 是一个没人引用的死代码文件（任何 layout 都没有 include 它）——不用管它。
- 个人信息只出现在这几个地方（已用 grep 确认）：`_config.yml`（一堆 `legacy_*` 开头的死配置，任何模板都不读取）、`_data/profile.yml`、`_data/profile_zh.yml`、`_data/landing.yml`，以及 `assets/my-linkedin.md` / `assets/AI_nav_statistics_summary.md`（Wei Yang 自己的草稿笔记，没有任何模板引用）。其余的（`_includes`、`_layouts`、`_sass`、`assets/js`、`Gemfile`、`.gitignore`）都是纯框架代码，不含任何个人信息。

## 内容来源（新站点要填进去的东西）

综合 `CV_HJJ_Aug2026.pdf`（最新、最权威）+ `legacy/index.html`（bio 措辞、社交链接、头像）+ legacy 里的 service 页面交叉核对：

- **身份信息**：Jujun Huang · Binghamton 大学（SUNY）管理学院 助理教授（2024年8月至今）· jhuang83@binghamton.edu · GitHub `jhuang2023` · LinkedIn `jujun-amy-huang` · Google Scholar（`user=3PwEPgoAAAAJ`）· SSRN（`per_id=4292234`）· 简历上没有电话号码。
- **研究方向**：Design Science；Data Science；LLMs；FinTech；Social Media Analytics。
- **科研经费**：1 项已提交（NSF，Co-PI）、1 项筹备中（PI）。
- **论文**：已发表 1 篇（POM 2022）、审稿中 2 篇、会议论文集 2 篇、工作论文 5 篇。
- **学术报告/会议**：2021–2026 年共 7 场。
- **学术服务**：2021–2026 年共 9 项期刊/会议审稿。
- **教学**：Binghamton（NLP MIS-480P、Practical Data Wrangling MIS-480D）+ Stevens（MIS-634，共 3 个学期）。
- **奖项**：Outstanding Dissertation Award、Best Student Paper（WITS）、Graduate Assistantship、Master's Fellowship。
- **教育经历**：Stevens 商学院 商业管理博士（信息系统方向）、Stevens 商学院 商业智能与分析硕士、上海对外经贸大学 管理学学士。
- **非学术工作经历**：联合国数据分析实习生（2018）、InsightWorks Ltd. 市场研究员（2015–2016）。

注意：简历里教育经历部分没有给出 Stevens 博士/硕士的具体起止年份。我会根据"Graduate Assistantship 2019–2023"+"Outstanding Dissertation Award 2023–2024"+"助理教授 2024年8月至今"推断博士阶段大约是 2019–2024 年，并在内容里标注这是推断值——迁移完之后如果不对可以很容易改。

## 文件操作

**直接从 `InscribeDeeper.github.io` 复制过来（不含个人信息，已用 grep 确认）**：`_includes/`、`_layouts/`、`_sass/`、`assets/js/`、`assets/main.scss`、`assets/favicon.ico`、`cv/index.md`、`resume/index.md`、`all/index.md`、`index.md`、`Gemfile`、`Gemfile.lock`、`.gitignore`、`LICENSE`（MIT 协议——保留，因为复用了 sproogen 主题的代码，按协议需要保留版权声明）。

**复制过来之后要重写内容**：`_config.yml`、`_data/profile.yml`、`_data/profile_zh.yml`、`_data/landing.yml`、`_data/ui.yml`、`_includes/head.html`（小改动：加一行 academicons CDN 链接）。

**不复制**（Wei Yang 专属内容 / 与个人 GitHub Pages 站点无关的主题作者/发布相关文件）：
- `assets/my-linkedin.md`、`assets/AI_nav_statistics_summary.md`（Wei Yang 自己的草稿笔记）
- `assets/resume/Wei-Yang-Resume-V7.3-Overview.pdf`、`images/wyang_img.jpg`
- `niw/` 整个目录（被去掉的视图）
- `.github/`（CI 工作流是 sproogen 自己发布 gem 用的流水线，限定 `github.repository_owner == 'sproogen'` 才会跑）、`_test/`、`lib/`、`modern-resume-theme.gemspec`、`CODE_OF_CONDUCT.md`、`CONTRIBUTING.md`、`app.json`、`Procfile`、`screenshot.png`（这些都是主题作者/gem 发布/Heroku 部署相关的东西，个人静态站点用不上）
- `README.md` 会**替换**成一份简短的、专属 jhuang 站点的说明（不是 sproogen 主题的推广文案）

**保留（方便本地开发，无个人信息，无害）**：`docker-compose.yml`、`Dockerfile`、`.dockerignore`。

**新增素材**：把 `legacy/authors/admin/J Huang.jpg` 复制为 `images/jhuang_img.jpg`；把 `CV_HJJ_Aug2026.pdf` 移动到 `assets/resume/CV_HJJ_Aug2026.pdf`（作为各视图的下载文件）。

**`legacy/` 目录**：原地保留作为历史参考（里面没有 Wei Yang 的内容），但会把 `legacy` 加进 `_config.yml` 的 `exclude:` 列表，这样 Jekyll 构建时不会把它当成正式页面发布到 `/legacy/*`。

**顺手清理**：删除根目录下遗留的 `Untitled` 和 `.DS_Store`（跟两个站点都无关的杂散文件）。

## `_config.yml` 重写内容

- 删掉整段死配置 `legacy_*` 开头的 key 以及 `legacy_content:` 列表（已确认没有任何模板会读取，纯粹是 Wei Yang 旧配置遗留下来的参考资料）。
- 保留 `version: 2`、`darkmode: false`、`sass:`、`plugins:`、`exclude:`（把 `legacy` 加进去）。
- 修掉 `footer_show_references` 那个小 hack：目前 `references_title: 551 260 0541` 直接把页脚文案替换成了 Wei Yang 的电话号码。把 `references_title` 去掉，让它回退成默认的 "References on request" 文案——这个说法本身就很符合学术 CV 的惯例（求职材料里常见），而且 jhuang 的简历本来也没有电话号码可以显示。
- 加上 `additional_links`，配置 Google Scholar + SSRN（图标用 academicons，见上文）。
- 加上 `title`/`description` 供 `jekyll-seo-tag` 使用（比如 title: "Jujun Huang"，description: "Assistant Professor of Management Information Systems, Binghamton University"）。

## `_data/profile.yml`（以及同步维护的 `_data/profile_zh.yml`）重写内容

**`person`**：姓名、职称（"Assistant Professor of Management Information Systems at Binghamton University"——特意让它包含 `company` 字符串，这样页头会自动把单位名变成链接）、company/company_url（Binghamton University）、邮箱、github_username、linkedin_username、website（`jhuang2023.github.io/`）。不设置 `phone`。

**`about`**：title "About Me"，`profile_image: images/jhuang_img.jpg`，content 换成一段简短 bio（改写自 `legacy/index.html` 里的开场白+研究方向那两行），而不是 Wei Yang 的技术栈介绍。把 `cv` 和 `resume` 两个视图的 `show_about` 设为 `true`（Wei Yang 的所有视图目前都是 false），这样照片+简介才会真正显示出来——效果上更接近老 Hugo 首页的样子。

**`sections`** —— 新的 section 内容库（完整 CV 用 12 个，`resume` 视图复用/精简出 3 个专属的）：

| section id | layout | group | 内容来源 |
|---|---|---|---|
| `research_interests` | text | research_interests | 简历 "RESEARCH" 那一行 |
| `grants` | list | grants | 简历 "GRANTS"（Submitted + In Development） |
| `publications_published` | list | publications_published | 简历 "Published Paper" |
| `publications_under_review` | list | publications_under_review | 简历 "Under Review Paper"（2 条） |
| `publications_proceedings` | list | publications_proceedings | 简历 "Conference Proceedings"（2 条） |
| `publications_working` | list | publications_working | 简历 "Working Paper"（5 条） |
| `presentations` | list | presentations | 简历 "PRESENTATION CONFERENCE"（7 条） |
| `academic_service` | text/list | academic_service | 简历 "ACADEMIC SERVICE"（9 条审稿记录） |
| `teaching_experience` | list | teaching_experience | 简历 "TEACHING EXPERIENCE" |
| `awards` | list | awards | 简历 "AWARD" |
| `education` | list | education | 简历 "EDUCATION"（年份为推断值，上文已标注） |
| `non_academic_experience` | list | non_academic_experience | 简历 "NON-ACADEMIC EXPERIENCE"（2 条） |
| `professional_summary_resume` | text | professional_summary | 仅 resume 用，综合写的一段简短开场白（CV 视图没有对应内容——因为简历原文本身就没有 summary 段落，所以完整版 `cv` 视图会跳过它，直接从 Research 开始，忠实还原原始文件结构） |
| `selected_publications_resume` | list | selected_publications | 仅 resume 用，精选：已发表论文 + 最近一篇会议论文集 |
| `selected_presentations_resume` | list | selected_presentations | 仅 resume 用，精选：最近 2 场报告 |

**`views`**：
- `cv`：title "Curriculum Vitae"，`show_about: true`，`downloads` 指向 CV_HJJ_Aug2026.pdf，sections 按简历顺序排列上表全部 12 个。
- `resume`：title "Resume"，`show_about: true`，下载同上，sections = `professional_summary_resume`、`research_interests`、`selected_publications_resume`、`teaching_experience`、`education`、`awards`、`selected_presentations_resume`。
- `all`：机制不变（`show_all_sections: true`、`dedupe_groups: false`）——上面新增的 section 会自动被它捕获，不需要额外配置。
- 完全去掉 `niw` 视图；删除 `niw/index.md`。

`profile_zh.yml` 保持完全相同的结构，所有文案翻译成中文（沿用该文件头部注释里说明的 en/zh 同步惯例）。

## `_data/landing.yml` + `_data/ui.yml`

- `career` 时间线 → 改成"教育与学术任职"：Binghamton 助理教授（2024至今）、Stevens 博士（约2019–2024）、Stevens 硕士、上海对外经贸大学学士——中英文都要改。
- `projects` 时间线 → 改成"论文与科研产出"：按时间列出 POM 2022 论文、WITS 2021 最佳学生论文报告、TREO/ICIS 2024、Pre-ICIS SIGDSA 2025、AOM Proceedings 2026 等——中英文都要改。
- `ui.yml`：只改跟内容相关的那几个字符串（`projects_label` 改成 "PUBLICATIONS"、`projects_title` 改成 "Publications & Research"、`projects_context`、`career_context`），中英文都要同步改；去掉 `profile_niw`；其余通用界面文案（print/back/live_demo 等）不用动。

## 验证方式

1. 在新仓库根目录跑 `bundle install`，然后 `bundle exec jekyll serve`，确认构建没有报错。
2. 用浏览器实际检查 `/`（landing 选择页 + 两条时间线预览，切换中英文语言按钮都测一下）、`/cv/`、`/resume/`、`/all/`——确认页面上完全没有残留的 "Wei Yang"/PiSrc/InscribeDeeper 字样。
3. 确认 `/cv/` 和 `/resume/` 上的下载按钮能正确下载到 `CV_HJJ_Aug2026.pdf`。
4. 确认 Google Scholar/SSRN/GitHub/LinkedIn 图标能正常显示并且链接正确；确认邮箱的 `mailto:` 链接正确。
5. 测试打印视图（点击打印按钮）在 `cv` 视图下排版正常。
6. 对最终仓库整体 `grep -r` 搜索 `wyang|wei.?yang|pisrc|inscribedeeper`，确认除了 `legacy/`（这是 jhuang 自己的历史内容，本来就该保留）之外没有任何残留。
