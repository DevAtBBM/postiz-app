import {
  IsDefined,
  IsIn,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { IsStrongPassword } from '@gitroom/nestjs-libraries/validators/is-strong-password.validator';

export class ForgotReturnPasswordDto {
  @IsString()
  @IsDefined()
  @IsStrongPassword()
  password: string;

  @IsString()
  @IsDefined()
  @IsIn([makeId(10)], {
    message: 'Passwords do not match',
  })
  @ValidateIf((o) => o.password !== o.repeatPassword)
  repeatPassword: string;

  @IsString()
  @IsDefined()
  @MinLength(5)
  token: string;
}
