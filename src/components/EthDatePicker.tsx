'use client';

import React from 'react';
import { AppDatePicker, AppDatePickerProps } from './AppDatePicker';

export { AppDatePicker };

/**
 * EthDatePicker now delegates directly to AppDatePicker so that
 * when the Owner sets the system calendar to Gregorian, all
 * forms automatically render Gregorian, and when Ethiopian,
 * they render Ethiopian.
 */
export function EthDatePicker(props: AppDatePickerProps & { name: string }) {
  return <AppDatePicker {...props} />;
}

export default EthDatePicker;
