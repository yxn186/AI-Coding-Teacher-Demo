# 素材说明

当前版本的人物头像、任务卡小图、小老师头像和顶部品牌图，都会优先读取 `assets/` 下的本地图片；如果图片不存在、路径为空或加载失败，页面会自动回退到内置 emoji，不会报错，也不会让界面留空。

## 文件夹结构

```text
assets/
  README.md
  brand/
    brand-photo.jpg
    brand-photo.jpeg
    brand-photo.png
    brand-photo.webp
  characters/
    cat.jpg
    rabbit.jpg
    dog.jpg
    teacher.jpg
  tasks/
    task-cat-hello.jpg
    task-rabbit-jump.jpg
    task-dog-walk.jpg
    task-cat-wait.jpg
    task-rabbit-jump3.jpg
    task-dog-grow-face.jpg
    task-message-hello.jpg
    task-relay-show.jpg
    task-free-lab.jpg
```

## 命名规则

### 角色头像

- `assets/characters/cat.jpg`
- `assets/characters/rabbit.jpg`
- `assets/characters/dog.jpg`
- `assets/characters/teacher.jpg`

### 任务卡小图

- `assets/tasks/task-cat-hello.jpg`
  对应任务 1：小猫打招呼
- `assets/tasks/task-rabbit-jump.jpg`
  对应任务 2：小兔一直跳
- `assets/tasks/task-dog-walk.jpg`
  对应任务 3：小狗往前走
- `assets/tasks/task-cat-wait.jpg`
  对应任务 4：小猫等一下
- `assets/tasks/task-rabbit-jump3.jpg`
  对应任务 5：小兔跳三次
- `assets/tasks/task-dog-grow-face.jpg`
  对应任务 6：小狗变大变脸
- `assets/tasks/task-message-hello.jpg`
  对应任务 7：消息打招呼
- `assets/tasks/task-relay-show.jpg`
  对应任务 8：接力表演
- `assets/tasks/task-free-lab.jpg`
  对应自由实验室

### 顶部品牌图

品牌图区优先按下面顺序查找：

1. `assets/brand/brand-photo.jpg`
2. `assets/brand/brand-photo.jpeg`
3. `assets/brand/brand-photo.png`
4. `assets/brand/brand-photo.webp`

推荐优先放 `jpg`。

## 页面里的回退逻辑

以下对象会优先读图片，失败时自动回退到 emoji：

- 左侧任务列表中的任务小图
- 角色标签里的角色头像
- 舞台中的角色图
- 右侧“小老师”面板里的老师头像
- 顶部品牌图区

当前默认 emoji 兜底如下：

- 小猫：`🐱`
- 小兔：`🐰`
- 小狗：`🐶`
- 小老师：`👩‍🏫`
- 品牌：`🧩`
- 各任务：使用对应任务含义的 emoji 小图

## 使用方式

1. 按上面的命名规则把图片放进对应目录。
2. 刷新页面。
3. 如果文件存在，页面会自动显示图片。
4. 如果文件不存在或加载失败，页面会自动显示 emoji。

不需要改代码，也不需要额外配置。
