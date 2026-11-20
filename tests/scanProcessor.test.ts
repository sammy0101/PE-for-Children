import { describe, expect, it } from 'vitest';
import {
  applyHighContrastScanFilter,
  computeRotatedDimensions,
  computeScaledDimensions,
  nextRotation,
} from '../src/domain/scanProcessor';

describe('scanProcessor', () => {
  it('cycles rotation in 90-degree increments and swaps dimensions on 90/270', () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(270)).toBe(0);
    expect(computeRotatedDimensions(800, 600, 90)).toEqual({ width: 600, height: 800 });
    expect(computeRotatedDimensions(800, 600, 180)).toEqual({ width: 800, height: 600 });
  });

  it('scales down large images while preserving aspect ratio', () => {
    expect(computeScaledDimensions(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(computeScaledDimensions(1000, 800, 1600)).toEqual({ width: 1000, height: 800 });
  });

  it('whitens light paper shadows and darkens ink in high-contrast filter', () => {
    // 像素1: 偏灰白紙張背景 (200,200,200), 像素2: 深色鉛筆字 (50,50,50)
    const input = new Uint8ClampedArray([200, 200, 200, 255, 50, 50, 50, 255]);
    const output = applyHighContrastScanFilter(input);

    expect(output[0]).toBe(255);
    expect(output[1]).toBe(255);
    expect(output[2]).toBe(255);
    expect(output[4]).toBeLessThan(30);
    expect(output[7]).toBe(255);
  });
});
