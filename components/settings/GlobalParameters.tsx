'use client';

import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ParameterSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

export function ParameterSlider({ label, value, onChange, min, max, step }: ParameterSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <Input
          type="number"
          className="w-20 h-7 text-xs"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          step={step}
          min={min}
          max={max}
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
