# Socket.IO 事件契约

当前后端使用 Socket.IO 4。管理后台 Socket 仅服务扫描器和元数据更新流程，本阶段保持旧事件名和 payload 不变。

## 认证

当 `config.auth` 为 `true` 时，只有 `admin` 用户可以连接管理后台 Socket。

支持的 token 传递方式：

- 推荐：首次 Engine.IO handshake 使用 `Authorization: bearer <jwt>`。
- 兼容：Socket.IO `auth.token`。
- 兼容旧前端：`query.token`。

当 `config.auth` 为 `false` 时，不启用 Socket 认证。

## 客户端发送事件

| 事件名 | Payload | 说明 |
| --- | --- | --- |
| `ON_SCANNER_PAGE` | 无 | 扫描页面进入或刷新时请求当前扫描状态。扫描中会触发子进程回放 `SCAN_INIT_STATE`。 |
| `PERFORM_SCAN` | 无 | 启动完整扫描。已有扫描/更新进程时会忽略。 |
| `PERFORM_UPDATE` | 无 | 启动元数据刷新，等价于 updater 子进程带 `--refreshAll`。已有扫描/更新进程时会忽略。 |
| `KILL_SCAN_PROCESS` | 无 | 向当前扫描/更新子进程发送 `{ exit: 1 }`。 |

## 服务端发送事件

| 事件名 | Payload | 说明 |
| --- | --- | --- |
| `success` | `{ message, user, auth }` | Socket 连接成功后立即发送。 |
| `SCAN_INIT_STATE` | `{ tasks, failedTasks, mainLogs, results }` | 扫描页面刷新时的状态快照。 |
| `SCAN_TASKS` | `{ tasks }` | 当前任务列表和任务日志更新。 |
| `SCAN_FAILED_TASKS` | `{ failedTasks }` | 失败任务列表更新。 |
| `SCAN_MAIN_LOGS` | `{ mainLogs }` | 主扫描日志更新。 |
| `SCAN_RESULTS` | `{ results }` | 扫描结果计数更新。 |
| `SCAN_FINISHED` | `{ message }` | 扫描或更新结束。 |
| `SCAN_ERROR` | 无 | 扫描或更新子进程以非零退出码结束。 |

## Payload 结构

`tasks` 项：

```json
{
  "rjcode": "000123",
  "result": "added",
  "logs": [
    {
      "level": "info",
      "message": "..."
    }
  ]
}
```

`failedTasks` 项与 `tasks` 项一致。

`mainLogs` 项：

```json
{
  "level": "info",
  "message": "..."
}
```

`results` 项：

```json
{
  "rjcode": "000123",
  "result": "added",
  "count": 1
}
```

`result` 当前可能值：

- `added`
- `failed`
- `skipped`
- `updated`
