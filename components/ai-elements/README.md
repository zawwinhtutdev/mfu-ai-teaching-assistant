# AI Elements - Vercel AI SDK Components

Custom AI Elements components built for the MFU AI Teaching Assistant, inspired by Vercel's AI SDK patterns.

## Components

### Message
Container component for chat messages that handles the layout and avatar display.

```tsx
import { Message, MessageContent } from "@/components/ai-elements"

<Message from="assistant">
  <MessageContent>
    AI response here
  </MessageContent>
</Message>
```

**Props:**
- `from`: `"user" | "assistant" | "system"` - Determines the message sender
- `children`: React nodes to render inside the message
- Standard HTML div attributes

### MessageContent
Styled container for the actual message content.

```tsx
<MessageContent from="user">
  Hello, AI!
</MessageContent>
```

**Props:**
- `from`: `"user" | "assistant" | "system"` - Applies appropriate styling
- `children`: React nodes
- Standard HTML div attributes

### Response
Renders text responses with optional Markdown support, including syntax highlighting for code blocks.

```tsx
import { Response } from "@/components/ai-elements"

<Response enableMarkdown={true}>
  # Hello

  This is **markdown** text with `code` support!

  \`\`\`javascript
  console.log('Syntax highlighted code!');
  \`\`\`
</Response>
```

**Props:**
- `enableMarkdown`: `boolean` - Enable markdown rendering (default: `true`)
- `children`: `string` - The text content to render
- Standard HTML div attributes

**Features:**
- Full markdown support
- Syntax highlighting for code blocks (using react-syntax-highlighter)
- Styled headings, lists, quotes, links
- Dark mode compatible

### Thinking
Loading indicator shown while AI is generating a response.

```tsx
import { Thinking } from "@/components/ai-elements"

<Thinking message="Processing your request..." />
```

**Props:**
- `message`: `string` - Custom loading message (default: "Thinking...")
- Standard HTML div attributes

**Features:**
- Animated dots
- Pulsing AI avatar
- Customizable message

## Usage Example

```tsx
"use client"

import { useChat } from "@ai-sdk/react"
import { Message, MessageContent, Response, Thinking } from "@/components/ai-elements"

export function ChatComponent() {
  const { messages, status } = useChat()

  return (
    <div>
      {messages.map((message) => (
        <Message key={message.id} from={message.role}>
          <MessageContent from={message.role}>
            {message.parts
              .filter((part) => part.type === "text")
              .map((part, i) => (
                <Response key={i} enableMarkdown={message.role === "assistant"}>
                  {part.text}
                </Response>
              ))}
          </MessageContent>
        </Message>
      ))}

      {status === "in_progress" && <Thinking />}
    </div>
  )
}
```

## Styling

All components use:
- Tailwind CSS for styling
- `cn()` utility for class merging
- Dark mode support
- Responsive design
- Gradient backgrounds

## Dependencies

- `react-markdown` - Markdown parsing
- `react-syntax-highlighter` - Code syntax highlighting
- `lucide-react` - Icons
- `tailwindcss` - Styling

## Customization

You can customize the components by:
1. Passing additional className props
2. Modifying the gradient colors in the component files
3. Adjusting markdown rendering options in Response component
4. Changing icon sizes and styles

## Future Enhancements

- [ ] Tool calling visualization
- [ ] Streaming text animation
- [ ] Copy-to-clipboard for code blocks
- [ ] Message reactions
- [ ] File attachments display
- [ ] Voice message support

