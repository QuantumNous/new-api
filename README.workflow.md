## 📌 日常维护分支说明

* **`upstream/main`**  ：源项目主分支（**只读**）
* **`origin/main`**    ：你的基线分支（❌ 不放业务二开代码）
* **`feature/xxx`**    ：日常开发分支（✅ 二开开发使用）

---

## 👨‍💻 团队日常开发流程

### 1️⃣ 从 `origin/main` 切出功能分支

```bash
git checkout main
git pull origin main
git checkout -b feature/login-enhance
```

> 📎 说明：
>
> * 确保 `main` 为最新代码
> * 每个需求 / 功能使用 **独立 feature 分支**

---

### 2️⃣ 功能开发完成后合并回 `origin/main`

```bash
git checkout main
git pull origin main
git merge feature/login-enhance
git push origin main
```

> ⚠️ 建议：
>
> * 合并前确保 feature 分支自测通过
> * 如有冲突，优先保证 `main` 稳定性

---

## 🔄 源项目更新同步流程

### 整体流程示意

```
upstream/main
     ↓
origin/main
     ↓
feature/xxx（rebase / merge main）
```

---

### 1️⃣ 拉取源项目更新

```bash
git fetch upstream
```

---

### 2️⃣ 合并源项目到本地 `main`

```bash
git checkout main
git merge upstream/main
```

> 📌 说明：
>
> * 仅做**源项目代码同步**
> * 不在此步骤引入业务二开

---

### 3️⃣ 推送更新后的 `main` 到远端

```bash
git push origin main
```

---

### 4️⃣ 更新已有功能分支（可选）

根据团队规范选择以下方式之一：

#### ✅ Rebase（推荐，历史更干净）

```bash
git checkout feature/xxx
git rebase main
```

#### ⚠️ Merge（保留分支历史）

```bash
git checkout feature/xxx
git merge main
```

---

## ✅ 最佳实践总结

* 🚫 **禁止**在 `origin/main` 直接开发业务代码
* 🌱 **所有二开**必须从 `feature/*` 分支开始
* 🔄 定期同步 `upstream/main`，减少大版本冲突
* 🧹 feature 分支合并后可及时删除

---

> 📘 本文档用于团队 Git 分支规范与日常协作说明
