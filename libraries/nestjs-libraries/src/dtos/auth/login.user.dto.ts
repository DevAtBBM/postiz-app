import {
  IsDefined,
  IsEmail,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Provider } from '@prisma/client';
import { IsStrongPassword } from '@gitroom/nestjs-libraries/validators/is-strong-password.validator';

export class LoginUserDto {
  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.providerToken)
  @MinLength(3)
  // Note: We keep min length validation for login to support existing weak passwords
  // Strong password validation is enforced during registration and password reset
  password: string;

  @IsString()
  @IsDefined()
  provider: Provider;

  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.password)
  providerToken: string;

  @IsEmail()
  @IsDefined()
  email: string;
}
