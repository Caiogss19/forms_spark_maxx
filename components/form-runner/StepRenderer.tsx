"use client";

import type { Step } from "@/lib/schema";

import { Consent } from "@/components/form-runner/fields/Consent";
import { Currency } from "@/components/form-runner/fields/Currency";
import { DateField } from "@/components/form-runner/fields/DateField";
import { Dropdown } from "@/components/form-runner/fields/Dropdown";
import { Email } from "@/components/form-runner/fields/Email";
import { FileUpload } from "@/components/form-runner/fields/FileUpload";
import { LongText } from "@/components/form-runner/fields/LongText";
import { MultiChoice } from "@/components/form-runner/fields/MultiChoice";
import { NotImplemented } from "@/components/form-runner/fields/NotImplemented";
import { NumberField } from "@/components/form-runner/fields/NumberField";
import { Phone } from "@/components/form-runner/fields/Phone";
import { Rating } from "@/components/form-runner/fields/Rating";
import { Scale } from "@/components/form-runner/fields/Scale";
import { ShortText } from "@/components/form-runner/fields/ShortText";
import { SingleChoice } from "@/components/form-runner/fields/SingleChoice";
import { Statement } from "@/components/form-runner/fields/Statement";
import { ThankYou } from "@/components/form-runner/fields/ThankYou";
import { UrlField } from "@/components/form-runner/fields/UrlField";
import type { FieldProps } from "@/components/form-runner/fields/types";

interface Props extends FieldProps {
  redirectUrl?: string;
}

export function StepRenderer(props: Props) {
  const { step } = props;
  const type = step.type as Step["type"];

  switch (type) {
    case "short_text":
      return <ShortText {...props} />;
    case "long_text":
      return <LongText {...props} />;
    case "email":
      return <Email {...props} />;
    case "phone":
      return <Phone {...props} />;
    case "single_choice":
      return <SingleChoice {...props} />;
    case "multi_choice":
      return <MultiChoice {...props} />;
    case "dropdown":
      return <Dropdown {...props} />;
    case "rating":
      return <Rating {...props} />;
    case "scale":
      return <Scale {...props} />;
    case "date":
      return <DateField {...props} />;
    case "number":
      return <NumberField {...props} />;
    case "currency":
      return <Currency {...props} />;
    case "url":
      return <UrlField {...props} />;
    case "file":
      return <FileUpload {...props} />;
    case "consent":
      return <Consent {...props} />;
    case "statement":
      return <Statement {...props} />;
    case "thank_you":
      return <ThankYou redirectUrl={props.redirectUrl} />;
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return <NotImplemented {...props} />;
    }
  }
}
