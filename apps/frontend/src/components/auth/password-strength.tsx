'use client';

import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

interface PasswordRequirement {
  text: string;
  met: boolean;
}

interface PasswordStrengthProps {
  fieldName: string;
}

export function PasswordStrength({ fieldName }: PasswordStrengthProps) {
  const { watch } = useFormContext();
  const password = watch(fieldName) || '';

  const requirements = useMemo<PasswordRequirement[]>(() => {
    return [
      {
        text: 'At least 8 characters',
        met: password.length >= 8,
      },
      {
        text: 'One uppercase letter (A-Z)',
        met: /[A-Z]/.test(password),
      },
      {
        text: 'One lowercase letter (a-z)',
        met: /[a-z]/.test(password),
      },
      {
        text: 'One number (0-9)',
        met: /\d/.test(password),
      },
      {
        text: 'One special character (!@#$%^&*...)',
        met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      },
    ];
  }, [password]);

  const metRequirements = requirements.filter(req => req.met).length;
  const strength = metRequirements === 5 ? 'strong' : metRequirements >= 3 ? 'medium' : 'weak';
  const strengthText = metRequirements === 5 ? 'Strong' : metRequirements >= 3 ? 'Medium' : 'Weak';

  const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  };

  // Only show if password exists and either has unmet requirements or is weak
  if (!password || (metRequirements === 5 && strength === 'strong')) return null;

  return (
    <div className="mt-0 mb-0.5 p-1.5 bg-gray-50 rounded-md border">
      <div className="flex items-center mb-1">
        <span className="text-xs font-medium text-gray-700 mr-2">
          Password strength:
        </span>
        <span className={`text-xs font-semibold ${
          strength === 'strong' ? 'text-green-600' :
          strength === 'medium' ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {strengthText}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${strengthColors[strength]}`}
          style={{ width: `${(metRequirements / 5) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {requirements.map((requirement, index) => (
          <div
            key={index}
            className={`flex items-center text-xs ${
              index === 4 ? 'col-span-2' : ''
            }`}
          >
            <span className={`mr-1 ${
              requirement.met ? 'text-green-500' : 'text-gray-400'
            }`}>
              {requirement.met ? '✓' : '○'}
            </span>
            <span className={requirement.met ? 'text-gray-700' : 'text-gray-500'}>
              {requirement.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}