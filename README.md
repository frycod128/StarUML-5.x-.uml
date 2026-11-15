# StarUML 5 UML Agent Skill

本仓库提供一个可复用的 Agent Skill，用于创建、修改和验证经典 StarUML 5.x
使用的 `.uml` 项目文件（XPD XML）。目标格式包括用例图、类图、活动图、状态图、
顺序图和通信图。

这不是常规的 Node/Python 应用，也没有单独的构建入口。仓库中唯一的能力入口是
[`staruml5-uml/SKILL.md`](staruml5-uml/SKILL.md)。Agent 完成“装载”是指：发现该
skill 的元数据，并在执行任务前完整读取 `SKILL.md` 及其任务所需引用文件。

> 版本边界：本 skill 面向 StarUML 5.x 的 XPD XML，不处理 StarUML 6/7 的
> `.mdj` JSON 项目。如果最终必须使用 StarUML 5.x，才应激活本 skill。

## Agent 装载协议

当任务涉及生成、编辑或排查 StarUML 5 `.uml` 文件时，Agent 必须按以下顺序装载
skill，然后再开始修改文件：

1. **优先使用显式调用。** 在支持 skills 的 Codex 会话中输入
   `$staruml5-uml`；也可以先运行 `/skills` 确认该 skill 是否已经出现在列表中。
   显式调用会让宿主读取对应的 `SKILL.md`。
2. **未出现在可用 skill 列表中时，直接按路径装载。** 从仓库根目录完整读取
   [`staruml5-uml/SKILL.md`](staruml5-uml/SKILL.md)。读取时不要只读 YAML
   frontmatter 或前几段；必须读完整个文件。
3. **将 skill 目录作为相对路径基准。** `SKILL.md` 中的
   `references/...`、`scripts/...`、`assets/...` 都相对于
   `staruml5-uml/`，而不是相对于仓库根目录。若 Agent 在仓库根目录执行命令，
   应使用诸如 `python staruml5-uml/scripts/validate_xpd.py` 的完整相对路径。
4. **按任务追加读取引用，不要预加载无关文件。**

| 任务 | 必须追加读取 |
| --- | --- |
| 生成或编辑任一种受支持的图 | [`references/format.md`](staruml5-uml/references/format.md) |
| 生成或编辑顺序图、通信图 | [`references/interaction-diagrams.md`](staruml5-uml/references/interaction-diagrams.md) |
| 遇到加载、布局或关系错误 | 先查 `SKILL.md` 的 Troubleshooting，再读错误类型对应的引用文件 |

完成上述步骤后，Agent 应能明确回答以下三项，才可视为已经装载：

- skill 根目录是 `staruml5-uml/`；
- 已完整读取 `SKILL.md`，且已读取当前图种所需的引用；
- 知道本任务必须输出 StarUML 5 XPD XML，而不是 StarUML 6/7 JSON。

## 最短装载方式

不需要安装时，可以直接在任务提示中加入：

```text
请使用 $staruml5-uml。若当前会话没有该 skill，请从仓库根目录完整读取
staruml5-uml/SKILL.md；所有相对路径以 staruml5-uml/ 为基准。读取完成后再创建、
修改或验证 .uml 文件。涉及顺序图或通信图时，同时读取
staruml5-uml/references/interaction-diagrams.md。
```

这种直接读取方式适用于所有能够访问本仓库的 Agent，不依赖宿主的自动发现机制。

## 安装为仓库级自动发现 Skill

Codex 会在从当前工作目录到仓库根的 `.agents/skills` 中扫描 skill。推荐在 Windows
PowerShell 中从仓库根目录创建一个目录联接（junction），这样仓库成为唯一源码，
后续修改无需再次复制：

```powershell
$repoRoot = (Resolve-Path .).Path
$skillSource = Join-Path $repoRoot 'staruml5-uml'
$skillsDir = Join-Path $repoRoot '.agents\skills'
$skillLink = Join-Path $skillsDir 'staruml5-uml'

New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null
if (-not (Test-Path -LiteralPath $skillLink)) {
    New-Item -ItemType Junction -Path $skillLink -Target $skillSource | Out-Null
}
```

在 Unix 主机上，等价方式是：

```sh
mkdir -p .agents/skills
ln -s ../../staruml5-uml .agents/skills/staruml5-uml
```

安装后应从仓库根目录启动新的 Codex 会话。输入 `$` 选择
`staruml5-uml`，或运行 `/skills` 核对列表。Codex 通常会自动检测新增和修改的
skill；如果仍未出现，再重启 Codex。

如果宿主机不能建立目录联接或符号链接，也可以把整个
`staruml5-uml/` 目录复制到 `.agents/skills/staruml5-uml/`。不要只复制
`SKILL.md`，因为脚本、引用和示例本身就是 skill 的组成部分。

## 装载自检

先在仓库根目录验证核心 XPD 构造器：

```powershell
node .\staruml5-uml\scripts\xpd.js --self-test
```

当前预期结果为类似：

```text
SELF-TEST OK — 19 objects, 11 views, 7612 bytes
```

再确认 Agent 能看到以下入口和配套资源：

```text
README.md
staruml5-uml/
├── SKILL.md
├── agents/openai.yaml
├── references/
├── scripts/
└── assets/
```

最后用一个明确任务验证触发是否生效，例如：“请使用 `$staruml5-uml` 创建一个
StarUML 5 用例图，并在交付前运行该 skill 规定的静态校验。”

## 运行依赖与安全边界

- Node.js：运行 `scripts/xpd.js` 和示例生成器。
- Python 3：运行 `scripts/validate_xpd.py` 及元模型辅助脚本。
- PowerShell 7：运行 `scripts/open_check.ps1`。
- StarUML 5.x：仅在获准进行真实桌面打开验证时需要。

静态校验不能替代真实打开验证，但 `scripts/open_check.ps1` 会终止所有正在运行的
StarUML 实例。Agent 必须取得明确的桌面操作授权、提醒用户保存工作，并串行执行
打开检查；不得并行启动多个 StarUML 检查。

skill 的完整技术约定、工作流和故障表以
[`staruml5-uml/SKILL.md`](staruml5-uml/SKILL.md) 为准。本 README 只负责说明如何
发现、装载和验证该 skill。

## 参考资料

- [OpenAI Docs: Build skills](https://learn.chatgpt.com/docs/build-skills)
