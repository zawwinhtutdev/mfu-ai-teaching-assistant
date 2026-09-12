"use client"

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Checkbox,
  type CheckboxProps,
} from '@/components/animate-ui/components/radix/checkbox'

interface RadixCheckboxDemoProps {
  checked: boolean | 'indeterminate'
  variant: CheckboxProps['variant']
  size: CheckboxProps['size']
  onCheckedChange?: (checked: boolean) => void
}

export const RadixCheckboxDemo = ({
  checked,
  variant,
  size,
  onCheckedChange,
}: RadixCheckboxDemoProps) => {
  const [isChecked, setIsChecked] = useState(checked ?? false)

  useEffect(() => {
    setIsChecked(checked)
  }, [checked])

  const handleCheckedChange = (newChecked: boolean) => {
    setIsChecked(newChecked)
    onCheckedChange?.(newChecked)
  }

  return (
    <Checkbox
      checked={isChecked}
      onCheckedChange={handleCheckedChange}
      variant={variant}
      size={size}
    />
  )
}
