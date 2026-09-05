"use client";

import React, { useState, forwardRef } from 'react';
import ReactPhoneInput, { Value, Country, getCountryCallingCode } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './PhoneInput.css';

interface PhoneInputProps {
  name?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

const CustomInput = forwardRef<HTMLInputElement, any>(({ countryCode, ...props }, ref) => {
  return (
    <div className="custom-phone-input-inner">
      {countryCode && (
        <>
          <span className="phone-calling-code">
            +{getCountryCallingCode(countryCode)}
          </span>
          <span className="phone-separator">|</span>
        </>
      )}
      <input {...props} ref={ref} className="phone-input-field" />
    </div>
  );
});
CustomInput.displayName = 'CustomInput';

export function PhoneInput({
  name = 'phone',
  defaultValue = '',
  onChange,
  required = false,
  className = '',
  placeholder = '77 123 45 67'
}: PhoneInputProps) {
  const [value, setValue] = useState<Value | undefined>(
    (defaultValue as Value) || undefined
  );
  const [country, setCountry] = useState<Country>('SN');

  const handleChange = (val: Value | undefined) => {
    setValue(val);
    if (onChange) {
      onChange(val ? val.toString() : '');
    }
  };

  return (
    <div className={`phone-input-wrapper ${className}`} style={{ width: '100%' }}>
      {/* Hidden input to ensure FormData only gets the E.164 value */}
      <input type="hidden" name={name} value={value || ''} required={required} />
      
      {/* We purposefully do NOT pass "name" here to avoid duplicate FormData keys */}
      <ReactPhoneInput
        defaultCountry="SN"
        value={value}
        onChange={handleChange}
        onCountryChange={setCountry as any}
        placeholder={placeholder}
        inputComponent={CustomInput}
        countryCode={country} // Custom prop forwarded to CustomInput
        className="custom-react-phone-input"
        international={false}
      />
    </div>
  );
}
