# Animate UI - Animated Components Library

A collection of animated UI components built with Framer Motion and Radix UI, designed to enhance user interactions with smooth animations.

## Components

### AnimateButton
An enhanced button component with multiple animation types and smooth transitions.

```tsx
import { AnimateButton } from "@/components/animate-ui"

<AnimateButton
  animationType="bounce"
  variant="gradient"
  onClick={() => console.log('Clicked!')}
>
  Click me!
</AnimateButton>
```

**Props:**
- `animationType`: `"bounce" | "pulse" | "shake" | "glow" | "slide" | "rotate"`
- `variant`: `"default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "gradient" | "animated"`
- `size`: `"default" | "sm" | "lg" | "icon" | "animated"`
- `delay`: `number` - Animation delay in seconds
- `duration`: `number` - Animation duration in seconds
- Standard button props

**Animation Types:**
- **bounce**: Vertical bounce on hover
- **pulse**: Scale animation on hover
- **shake**: Horizontal shake on hover
- **glow**: Glowing shadow effect on hover
- **slide**: Horizontal slide on hover
- **rotate**: Rotation on hover

### DemoButton
A demo component showcasing different animation combinations.

```tsx
import { DemoButton } from "@/components/animate-ui"

<DemoButton
  animationType="glow"
  variant="animated"
  onClick={() => console.log('Demo clicked!')}
>
  Demo Button
</DemoButton>
```

### AnimateSlot
A slot component with built-in animations for composition.

```tsx
import { AnimateSlot } from "@/components/animate-ui"

<AnimateSlot asChild>
  <Link href="/page">Animated Link</Link>
</AnimateSlot>
```

## Features

### 🎨 **Animation Types**
- **Bounce**: Spring-based vertical movement
- **Pulse**: Scale-based breathing effect
- **Shake**: Attention-grabbing horizontal movement
- **Glow**: Subtle shadow enhancement
- **Slide**: Smooth horizontal translation
- **Rotate**: Gentle rotation effect

### 🎯 **Variants**
- **Default**: Standard button styling
- **Gradient**: Beautiful gradient backgrounds
- **Animated**: Special animated variant with enhanced effects
- **Outline**: Clean bordered style
- **Ghost**: Minimal hover effects

### ⚡ **Performance**
- Optimized animations with Framer Motion
- Hardware-accelerated transforms
- Smooth 60fps animations
- Reduced motion support

## Usage Examples

### Basic Animated Button
```tsx
<AnimateButton
  animationType="bounce"
  variant="gradient"
  onClick={handleClick}
>
  Get Started
</AnimateButton>
```

### Form Submit Button
```tsx
<AnimateButton
  type="submit"
  animationType="pulse"
  variant="gradient"
  disabled={isLoading}
>
  {isLoading ? 'Sending...' : 'Send Message'}
</AnimateButton>
```

### Icon Button
```tsx
<AnimateButton
  size="icon"
  animationType="rotate"
  variant="outline"
  onClick={handleAction}
>
  <Plus className="h-4 w-4" />
</AnimateButton>
```

### Quick Action Buttons
```tsx
<div className="grid gap-3 sm:grid-cols-2">
  <AnimateButton
    animationType="bounce"
    variant="outline"
    onClick={() => sendMessage("Question 1")}
  >
    Question 1
  </AnimateButton>
  <AnimateButton
    animationType="pulse"
    variant="outline"
    onClick={() => sendMessage("Question 2")}
  >
    Question 2
  </AnimateButton>
</div>
```

## Customization

### Custom Animation Timing
```tsx
<AnimateButton
  animationType="bounce"
  delay={0.2}
  duration={0.3}
>
  Delayed Animation
</AnimateButton>
```

### Custom Styling
```tsx
<AnimateButton
  animationType="glow"
  className="w-full bg-purple-600 hover:bg-purple-700"
>
  Custom Styled Button
</AnimateButton>
```

## Dependencies

- `framer-motion` - Animation library
- `@radix-ui/react-slot` - Composition primitive
- `class-variance-authority` - Variant management
- `lucide-react` - Icons
- `tailwindcss` - Styling

## Best Practices

1. **Use appropriate animation types** for different contexts
2. **Keep animations subtle** to avoid overwhelming users
3. **Test on different devices** for performance
4. **Consider reduced motion preferences**
5. **Use consistent animation timing** across the app

## Future Enhancements

- [ ] More animation types
- [ ] Stagger animations for button groups
- [ ] Loading state animations
- [ ] Sound effects integration
- [ ] Gesture-based animations
- [ ] Accessibility improvements

---

**Built with ❤️ for the MFU AI Teaching Assistant**
