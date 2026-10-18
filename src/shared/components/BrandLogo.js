import React from 'react';
import { Image } from 'react-native';

const BRAND_MARK = require('../../../assets/brand-mark.png');

/**
 * BrandLogo
 * The real StagHaus logo (gold stag in the double octagon), cropped to its edges so
 * `size` is the logo's actual width/height. Replaces a hand-drawn SVG approximation.
 */
export default function BrandLogo({ size = 120, style }) {
  return (
    <Image
      source={BRAND_MARK}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="StagHaus logo"
    />
  );
}
