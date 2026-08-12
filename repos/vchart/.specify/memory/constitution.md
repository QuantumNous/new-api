# VisActor/VChart 项目宪法 (Constitution)

### 引言：VisActor/VChart 项目宪法

本文档是 **VisActor/VChart** 项目的“宪法”，旨在为所有参与者（包括工程负责人、核心开发者、贡献者）提供一套统一的、可执行的工程规范与协作准则。它的核心目标是：在确保代码质量、提升协作效率、保障多端体验一致性的前提下，让 VChart 成为一个健壮、可扩展且易于维护的数据可视化解决方案。

**所有代码的开发、评审与合并，都必须严格遵守本宪法。** 它将作为我们工程实践的“单一事实来源”，并与 `SpecKit` / `OpenSpec` 等规范驱动工具深度集成，确保从需求到实现的每一个环节都清晰、可控、可追溯。

### 核心原则

VChart 项目的每一个决策与行动，都应遵循以下核心原则：

- **质量优先 (Quality First)**：代码的健壮性、可读性与可维护性是最高优先级。我们追求的不仅是功能的实现，更是优雅、可靠的工程艺术。

- **用户体验驱动 (User Experience-Driven)**：无论是开发者用户还是最终用户，我们都致力于提供一流的体验。这包括清晰的 API、详尽的文档、卓越的性能和跨平台的一致性。

- **规范驱动开发 (Specification-Driven Development, SDD)**：我们相信“先对齐，再编码”。所有重要变更都应始于一份清晰的规范，通过工具链（如 SpecKit）确保 AI 与人类协作者在动工前就达成共识，最大限度减少返工与偏离。

- **开放与协作 (Openness & Collaboration)**：VChart 是一个开放的社区项目。我们鼓励透明的沟通、建设性的代码评审和知识共享，共同推动项目发展。

- **增量演进 (Incremental Evolution)**：在保持核心稳定的前提下，我们拥抱变化，通过模块化、可插拔的架构设计，支持新功能、新渲染环境和新交互模式的平滑融入。

### Monorepo/Rush 治理

VChart 采用 **Rush.js** 管理其 monorepo 结构。所有包的开发、依赖与发布活动，均需遵循以下治理规则。

#### 包（Package）边界与职责

仓库内的包根据其职责被明确划分为几类（依据 `rush.json` 中的 `tags` 字段）：

- **核心包 (** **`package`** **)**:

  - `@visactor/vchart`: 项目的核心，包含所有图表逻辑、组件和生命周期管理。
  - `@visactor/vchart-types`: **类型定义中心**。所有公共 API 的类型、事件、配置项（Spec）结构都必须在这里定义。
  - `@visactor/vchart-schema`: **JSON Schema 中心**。根据 `vchart-types` 生成，用于配置的校验与智能提示。
  - `@visactor/react-vchart`, `@visactor/taro-vchart`, `@visactor/lark-vchart`, `@visactor/wx-vchart`, `@visactor/openinula-vchart` 等：**框架封装与生态扩展包**。它们负责将 `@visactor/vchart` 的能力适配到不同前端框架或小程序环境。
  - `@visactor/vchart-extension`: 官方插件与扩展能力的集合。

- **共享工具包 (** **`share`** **)**:

  - `@internal/eslint-config`: **ESLint 规则集**。所有包的 ESLint 配置必须继承自此包，确保代码风格检查的一致性。
  - `@internal/ts-config`: **TypeScript 配置基线**。所有包的 `tsconfig.json` 必须继承自此包的 `tsconfig.base.json`，确保编译选项的统一。

- **内部工具包 (** **`tool`** **)**:

  - `@internal/bundler`, `@internal/typescript-json-schema` 等：用于构建、发布、文档生成等 CI/CD 流程的内部脚本与工具。

- **文档站点 (** **`doc`** **)**:
  - `@internal/docs`: **官方文档与示例站点**。所有对外可见的功能、API 变更、新增图表类型，都必须在此站点得到体现。

#### 跨包依赖与开发节奏

- **依赖规则**:

  - 业务逻辑**严禁**跨包直接引用内部（未导出）的函数或变量。所有跨包调用必须通过包的 `index.ts` 导出。
  - 框架封装包（如 `react-vchart`）**只应依赖** `@visactor/vchart` 和 `@visactor/vchart-types`，不应依赖其他生态包。
  - 所有业务包（`packages/*`）都必须在其 `package.json` 中将 `@internal/eslint-config` 和 `@internal/ts-config` 作为 `devDependency`，并正确配置 `eslint` 和 `tsconfig`。

- **开发命令**:
  - **`rush update`**: 拉取新代码或切换分支后，必须首先执行此命令来安装/更新所有依赖。
  - **`rush build -t <project-name>`**: 当地开发或修改时，**强烈建议**使用 `--to` (`-t`) 参数缩小构建范围，只构建你关心的包及其上游依赖。例如，修改 `vchart` 后，只想构建 `react-vchart`，应执行 `rush build -t @visactor/react-vchart`。
  - **`rush docs`**: 本地启动文档与示例站点。当进行任何对用户可见的变更（如新增 API、修改配置项）时，**必须**通过此命令验证文档和示例是否同步更新。

#### 发布与版本策略

- **可发布性 (** **`shouldPublish`** **)**:

  - 只有在 `rush.json` 中 `shouldPublish` 标记为 `true` 的包才能被发布到 npm。这主要包括 `@visactor/vchart` 及其生态包。
  - `@internal/*` 包**严禁**发布。

- **版本策略 (** **`versionPolicy`** **)**:

  - 核心包（`@visactor/vchart`）、类型包（`@visactor/vchart-types`）及所有生态包共享同一个版本策略 `vchartMain`。这意味着在执行 `rush change` 和 `rush version` 时，它们的版本号会**同步、一致地提升**。
  - 当引入一个破坏性变更时，必须在 `rush change` 中选择 `major` 版本提升。

- **更新共享包**:
  - 对 `share` 目录下的 `@internal/eslint-config` 或 `@internal/ts-config` 的修改，必须经过技术委员会的评审，因为它会影响到所有包的开发基线。
  - 更新后，需要执行 `rush build -t <package-name>` 来验证下游包是否能正常构建。

### 代码质量与类型约束

我们坚信，高质量的代码是项目生命力的基石。所有贡献者必须遵循以下编码与质量标准。

#### TypeScript：我们的契约

VChart 完全使用 **TypeScript** 编写，并采用严格的类型策略来提升代码的健壮性和可维护性。

- **严格模式对齐**: 所有 `tsconfig.json` 文件必须继承自 `share/ts-config/tsconfig.base.json`。该基线配置启用了 `strict: true` 模式，包括：

  - **`"noImplicitAny": true`**: **严禁**使用隐式的 `any` 类型。所有变量、函数参数和返回值都必须有明确的类型定义。对于确实无法预知类型的场景，必须显式使用 `any`，并添加注释说明原因。
  - **`"noImplicitThis": true`**: 确保 `this` 的指向在任何时候都是明确的。
  - **`"strictNullChecks": false`** (当前状态): 尽管 `strict` 为 `true`，但项目暂时放宽了 `strictNullChecks`。未来的目标是开启此项，新代码应尽可能假设此规则已开启，并对 `null` 和 `undefined` 进行显式处理。

- **类型即文档**: 接口（`interface`）和类型别名（`type`）应具有清晰的命名，并使用 TSDoc 注释解释其用途、属性和泛型参数。
  - 所有对外的配置项、API、事件等，其类型定义都必须收敛在 `@visactor/vchart-types` 包中。

#### ESLint & Prettier：我们的风格指南

代码风格的一致性对于多人协作至关重要。我们通过 ESLint 和 Prettier 强制执行统一的编码风格。

- **ESLint 执行**:

  - 所有包的 `.eslintrc.js` 必须依赖 `@internal/eslint-config`。
  - 在编码过程中，IDE 必须集成 ESLint 插件，实时提示错误。
  - **提交前修复**：`rush lint` 或 `npm run lint` 必须在提交代码前执行，并修复所有可自动修复的错误（`--fix`）。
  - **关键规则**（继承自 `common.js`）：
    - `'no-console': 'error'`: **严禁**在生产代码中使用 `console.log` 等调试语句。
    - `'no-debugger': 'error'`: **严禁**在代码中保留 `debugger`。
    - `'@typescript-eslint/no-unused-vars'`: 未使用的变量或参数（除非以下划线 `_` 开头）将被视为错误。

- **Prettier 格式化**:

  - 项目根目录的 `.prettierrc.js` 定义了统一的格式化规则（如 `printWidth: 120`, `singleQuote: true`）。
  - 所有开发者应在 IDE 中配置“保存时自动格式化”（Format on Save），或在提交前手动运行格式化命令。

- **提交前校验 (Lint-Staged)**:
  - 项目配置了 `lint-staged`（见 `.lintstagedrc` 文件），它会通过 Git 钩子（husky）在 `git commit` 时自动对暂存区（staged）的 `.ts` 和 `.tsx` 文件执行 `eslint --fix` 和 `prettier --write`。
  - **这意味着，任何不符合规范的代码都无法被提交。**

### 技术标准与工程流程

为确保项目的长期健康发展，我们建立了一系列标准化的工程流程。

#### 测试：质量的守护者

- **单元测试**:

  - 所有核心逻辑、复杂算法、工具函数都**必须**有单元测试覆盖。
  - 测试框架采用 Jest 或 Vitest。测试文件应与源文件相邻，命名为 `*.test.ts` 或 `*.spec.ts`。
  - 在提交涉及核心逻辑的变更时，**必须**同步添加或更新相应的单元测试。
  - 执行 `rush test` 可以在本地运行所有测试。

- **回归测试**:

  - 当修复一个 Bug 时，**强烈建议**为该 Bug 编写一个复现此问题的回归测试用例，以防止未来再次出现。
  - 所有图表的视觉表现回归测试通过 VChart 的截图对比能力实现，CI 将会自动执行。

- **跨端测试**:
  - 由于 VChart 支持多端环境（H5、小程序等），在引入新的 API、Canvas 特性或改动底层渲染逻辑时，**必须**在所有目标平台上进行手动或自动化验证，确保行为一致。

#### 文档与示例：开发者的指南针

- **文档同步**: **“无文档，不发布”**。

  - 任何对用户可见的变更，包括但不限于 API 新增/修改、配置项变更、行为调整，都**必须**在 `docs/` 目录下的相应文档中得到更新。
  - `@visactor/vchart-types` 中的 TSDoc 注释是生成 API 文档的基础，必须保持准确和详尽。

- **示例案例**:
  - 对于新增的图表类型或重要功能，**必须**在 `docs/` 站点的示例（gallery）中添加一个或多个清晰的演示案例。
  - 示例代码本身也应是高质量、可读性强的，作为用户学习的最佳实践。
  - 本地验证：通过 `rush docs` 启动站点，确保文档渲染正常，示例运行符合预期。

#### API 兼容性与废弃流程

- **语义化版本控制 (SemVer)**: 我们严格遵循 SemVer。

  - **主版本号 (MAJOR)**: 当进行不兼容的 API 变更时。
  - **次版本号 (MINOR)**: 当以向后兼容的方式添加新功能时。
  - **修订号 (PATCH)**: 当进行向后兼容的 Bug 修复时。

- **API 废弃 (Deprecation) 流程**:
  1.  **标记废弃**: 当决定废弃一个公共 API 时，应使用 TSDoc 的 `@deprecated` 标记，并提供替代方案和预计移除的版本。
  1.  **运行时警告**: 在废弃的函数或方法内部，应添加一个只在开发环境下（`process.env.NODE_ENV !== 'production'`）触发的警告（`console.warn`），提示用户 API 已废弃。
  1.  **过渡期**: 至少在一个次版本（minor release）的过渡期内保留该 API。
  1.  **移除**: 在下一个主版本（major release）发布时，可以安全地移除该废弃 API。

### 分支与评审节奏

清晰的分支模型和高效的代码评审是保障协作顺畅的关键。

#### 分支管理

- **主分支**:

  - `main`: **稳定的主分支**。所有发布版本都基于 `main` 分支。只接受来自 `develop` 分支或紧急修复（hotfix）分支的合并。
  - `develop`: **开发主干分支**。所有功能开发和日常 Bug 修复都应从 `develop` 分支创建新分支，并最终合并回 `develop`。这是我们日常协作的中心。

- **功能/修复分支**:
  - **命名规范**: 推荐使用 `feature/<feature-name>`、`fix/<issue-number>` 或 `chore/<description>` 的格式。
    - 示例: `feature/brush-zoom`, `fix/1234`
  - 每个分支应聚焦于一个独立的、原子性的任务。

#### Pull Request (PR) 与代码评审

- **创建 PR**:

  - 所有代码变更**必须**通过 Pull Request 的形式提交。
  - PR 的目标分支通常是 `develop`。
  - PR 的标题应清晰地描述变更内容，遵循 **Conventional Commits** 规范（见“版本与发布治理”章节）。
  - PR 的描述区应详细说明“为什么”和“做了什么”，关联相关的 Issue，并提供测试说明或截图。

- **评审要点**:

  - **规范对齐**: 代码是否完全遵循本宪法的所有规定（类型、Linter、测试、文档）？
  - **逻辑正确性**: 实现是否准确、高效地解决了问题？是否存在潜在的边界情况未处理？
  - **架构与设计**: 代码是否遵循了项目既有的设计模式？是否引入了不必要的技术债务？
  - **跨包影响**: 变更是否对 monorepo 中的其他包产生影响？影响是否已在 PR 中说明并得到验证？
  - **文档与测试**: 是否同步更新了相关文档和单元/回归测试？
  - **可读性**: 代码是否清晰、易于理解？命名是否规范？

- **合并要求**:
  - 一个 PR 至少需要 **1-2** 名核心贡献者的批准（`Approve`）。
  - 所有 CI 检查（Lint, Test, Build）**必须**全部通过。
  - 在合并前，应解决所有评审中提出的 `blocking` 问题。

### 用户体验与跨端一致性

VChart 的核心价值之一是提供卓越且一致的用户体验。所有功能设计与实现都必须以此为目标。

#### 跨端一致性

- **行为对齐**: 图表在不同终端（桌面浏览器、H5、飞书/微信/Taro 小程序）上的核心交互行为（如 Tooltip、Crosshair、DataZoom、Legend 交互）**必须**保持一致。

- **渲染对齐**: 相同的图表 Spec 在不同终端上的视觉表现（颜色、布局、标签等）应尽可能一致，除非因平台限制而需进行特定适配。所有适配**必须**在文档中明确说明。

- **API 对齐**: 暴露给开发者的 API 和事件系统在所有封装包中（`react-vchart`, `lark-vchart` 等）应保持一致的命名和行为。

#### 性能目标

性能是用户体验的关键。所有代码变更都应关注其对性能的影响。

- **首屏渲染**:

  - 核心包 `@visactor/vchart` 的大小需持续监控。避免引入不必要的、体积庞大的第三方依赖。
  - 图表的初始化和首次渲染应尽可能快。对于大数据量场景，应优先考虑或提供增量渲染、懒加载等优化方案。

- **交互延迟**:

  - Tooltip、Crosshair 等高频交互的响应时间应低于 **16ms**，确保流畅不卡顿。
  - 应避免在事件回调中执行耗时长的同步计算。

- **动画开销**:
  - 动画效果应流畅、自然。使用 `VRender` 提供的动画能力，避免使用低效的 `setTimeout` 或 `setInterval` 实现动画。
  - 对于复杂的动画或大数据量场景，需评估其对 CPU/GPU 的开销，并提供关闭动画的选项。

#### 可访问性 (Accessibility)

我们致力于让数据可视化对所有人开放。

- **ARIA 支持**: 对于桌面端图表，应为关键的图表元素（如 series、axis）添加适当的 ARIA (Accessible Rich Internet Applications) 属性，使其能被屏幕阅读器等辅助技术识别。

- **替代文本**: 当图表无法渲染或在不支持的环境中，应提供有意义的替代文本（fallback content）。

- **焦点管理**: 键盘用户应能通过 `Tab` 键在图表的交互元素间导航。

### 安全与合规

项目的安全与合规是不可逾越的底线。

- **依赖审计**:

  - 定期运行 `npm audit` 或使用 Snyk 等工具对项目依赖进行安全漏洞扫描。
  - 发现高危漏洞时，必须立即创建 Issue 并制定修复计划。

- **许可证合规**:

  - VChart 采用 **MIT 许可证**。
  - **严禁**引入不兼容 MIT 许可证（如 GPL、AGPL）的第三方依赖。在添加新依赖时，必须审查其许可证类型。

- **第三方库引入限制**:
  - 引入新的第三方依赖必须经过充分的论证和评审。评估其必要性、维护状态、社区活跃度、体积和安全性。
  - 优先使用 VisActor 体系内的自有库（如 `VGrammar`, `VRender`），或经过社区广泛验证的、轻量级的库。

### 版本与发布治理

规范化的版本与发布流程是确保交付质量和可预测性的关键。

#### 提交信息规范

- 我们遵循 **Conventional Commits** 规范。所有 `git commit` 的 message 必须遵循 `<type>[optional scope]: <description>` 的格式。
  - **`feat`**: 新增功能。
  - **`fix`**: 修复 Bug。
  - **`docs`**: 文档变更。
  - **`style`**: 代码风格调整（不影响代码逻辑）。
  - **`refactor`**: 代码重构。
  - **`test`**: 新增或修改测试。
  - **`chore`**: 构建过程或辅助工具的变动。
  - `scope` (可选): 本次提交影响的范围，如 `(vchart)`, `(react-vchart)`, `(docs)`。

#### 变更日志 (Changelog)

- `rush change` 命令是生成变更日志的基础。每次提交功能或修复后，**必须**运行 `rush change`，并按照提示填写清晰、面向用户的变更描述。

- 这些描述将由 CI 自动聚合并生成 `CHANGELOG.md` 文件。

#### 发布前验证

在执行 `rush publish` 前，发布负责人**必须**完成以下验证清单：

1. **构建成功**: 在 `main` 分支上执行 `rush build`，确保所有 `shouldPublish: true` 的包都能成功构建。

1. **大小检查**: 对比上次发布版本，检查核心包（`@visactor/vchart`）的产物体积是否有非预期的增长。

1. **Tree-shaking 验证**: 确保项目产物是 tree-shaking 友好的，未使用的模块可以被现代构建工具正确移除。

1. **跨端验证**: 在所有支持的小程序和 H5 环境中，对本次发布的主要变更进行最终的功能回归测试。

1. **文档与示例**: 确认所有相关文档和示例都已更新并发布到线上。

### 规范驱动工作流 (SDD)

我们采用以 SpecKit/OpenSpec 为核心的规范驱动开发（SDD）工作流，确保 AI 与人类开发者高效、精准地协作。

- **编码前对齐规范**:

  - **严禁**在没有清晰规范的情况下开始任何重要的功能开发或重构。
  - 所有需求都应首先通过 `/specify` 或 `/proposal` 命令，转化为一份结构化的、包含验收标准的规范文档。

- **规范 → 计划 → 任务 → 实施**:

  - `spec.md`: 定义“做什么”，包含用户场景和验收标准。
  - `plan.md`: 定义“怎么做”，包含技术选型、架构设计、API 变更。
  - `tasks.md`: AI 根据 `plan` 自动拆解的可执行任务清单。
  - `implement`: **必须**严格按照 `tasks.md` 的任务列表逐一实现，禁止 AI 或开发者“自由发挥”。

- **按任务执行**: 在 Trae/Cursor/Claude Code 等环境中，开发者应以“任务为单位”与 AI 协作，例如：“请完成 tasks.md 中的 T001：在 `vchart-types` 中添加 `IBrush` 接口”。

- **归档与追溯**: 完成后，使用 `/archive` 命令归档变更，使规范成为项目的“活文档”，便于未来追溯决策历史。

### 站点与生态更新

VChart 的价值体现在其完整的生态和清晰的文档中。

- **站点与示例同步**:

  - 当 `@visactor/vchart` 核心包发生变更时，**必须**评估其对 `docs` 站点的文档和示例的影响，并同步更新。

- **生态封装包同步**:

  - 当 `@visactor/vchart` 的 API 或生命周期发生变更时，**必须**检查并更新所有相关的生态封装包（`react-vchart`, `taro-vchart` 等），确保其功能兼容。

- **对外文档与教程**:
  - 所有对外的 API 文档、教程、博客等内容，都应与最新发布的版本保持一致。

### **可执行检查清单 (MR Checklist)**

在创建 Pull Request (MR/PR) 之前，作者**必须**逐项核对以下清单。PR 模板中应包含此清单，并要求作者勾选确认。

- [ ] **代码规范**: 我已在本地运行 `rush lint` 并修复了所有 ESLint 错误。

- [ ] **测试覆盖**: 我已为新增的核心逻辑添加了单元测试，并执行 `rush test` 确保所有测试通过。

- [ ] **构建验证**: 我已执行 `rush build -t <my-package>` 确保我的变更没有破坏构建。

- [ ] **文档同步**: 我已更新了 `docs/` 目录下所有与本次变更相关的文档（API、教程等）。

- [ ] **示例更新**: 我已为新增的重要功能添加或更新了示例。

- [ ] **跨端验证**: 我已在所有受影响的平台（桌面、H5、小程序）验证了功能的正确性和一致性。

- [ ] **类型定义**: 所有对外的类型变更都已在 `@visactor/vchart-types` 中完成。

- [ ] **Conventional Commit**: 我的提交信息遵循了 Conventional Commits 规范。

- [ ] **宪法遵守**: 我确认本次提交的所有内容均符合 **VChart 项目宪法**。

**任何未完成此检查清单的 PR 都将被视为未准备就绪，并可能被拒绝合并。**
