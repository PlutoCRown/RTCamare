# Socket 事件类型系统

这个目录包含了类型安全的 Socket 事件类型定义，通过 TypeScript 类型体操实现了通过事件名自动推导参数类型的功能。

## 功能特性

1. **事件名枚举**：`SocketEventType` 枚举定义了所有可能的 Socket 事件类型
2. **类型安全的消息类型**：每个事件都有对应的参数类型定义
3. **自动类型推导**：通过事件名可以自动推导出对应的参数类型
4. **类型守卫**：提供了 `isSocketMessage` 函数用于类型检查

## 使用示例

### 基本用法

```typescript
import {
  SocketEventType,
  createSocketMessage,
  TypedSocketMessage,
} from '../../../shared/types/socket-events';

// 创建类型安全的消息
const joinMessage = createSocketMessage(SocketEventType.JOIN, {
  role: 'sender',
  room: 'demo',
});
// TypeScript 会自动推导出 joinMessage 的类型为 TypedSocketMessage<SocketEventType.JOIN>

// 发送消息
wsManager.send(joinMessage);

// 监听特定类型的事件（类型安全）
wsManager.on(SocketEventType.JOINED, (msg) => {
  // TypeScript 会自动推导出 msg 的类型
  // msg.role 和 msg.room 都有正确的类型提示
  console.log(msg.role, msg.room);
});

wsManager.on(SocketEventType.ERROR, (msg) => {
  // TypeScript 知道 msg.reason 是 string 类型
  console.error(msg.reason);
});
```

### 类型推导示例

```typescript
// 通过事件名自动推导参数类型
function handleMessage<T extends SocketEventType>(
  eventType: T,
  handler: (message: TypedSocketMessage<T>) => void
) {
  // handler 的参数类型会根据 eventType 自动推导
  wsManager.on(eventType, handler);
}

// 使用时，TypeScript 会自动推导出正确的类型
handleMessage(SocketEventType.JOINED, (msg) => {
  // msg 的类型自动推导为 TypedSocketMessage<SocketEventType.JOINED>
  // 包含 { type: 'joined', role: SocketRole, room: string }
  console.log(msg.role, msg.room);
});

handleMessage(SocketEventType.ERROR, (msg) => {
  // msg 的类型自动推导为 TypedSocketMessage<SocketEventType.ERROR>
  // 包含 { type: 'error', reason: string }
  console.error(msg.reason);
});
```

### 类型守卫

```typescript
import { isSocketMessage, SocketEventType } from '../../../shared/types/socket-events';

function handleAnyMessage(message: AnySocketMessage) {
  if (isSocketMessage(message, SocketEventType.JOINED)) {
    // 在这个分支中，TypeScript 知道 message 的类型是 TypedSocketMessage<SocketEventType.JOINED>
    console.log(message.role, message.room);
  } else if (isSocketMessage(message, SocketEventType.ERROR)) {
    // 在这个分支中，TypeScript 知道 message 的类型是 TypedSocketMessage<SocketEventType.ERROR>
    console.error(message.reason);
  }
}
```

## 类型体操原理

通过 TypeScript 的映射类型（Mapped Types）和条件类型（Conditional Types）实现：

1. **映射类型**：`SocketEventPayloads` 将每个事件类型映射到对应的参数类型
2. **联合类型**：`AnySocketMessage` 将所有事件类型联合成一个类型
3. **泛型约束**：`TypedSocketMessage<T>` 通过泛型参数约束确保类型安全
4. **类型推导**：TypeScript 编译器会根据事件名自动推导出对应的参数类型

## 添加新的事件类型

1. 在 `SocketEventType` 枚举中添加新的事件名
2. 在 `SocketEventPayloads` 接口中添加对应的参数类型定义
3. TypeScript 会自动处理类型推导
