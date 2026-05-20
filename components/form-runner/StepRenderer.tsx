"use client";

import type { Step } from "@/lib/schema";

import { Email } from "@/components/form-runner/fields/Email";
import { NotImplemented } from "@/components/form-runner/fields/NotImplemented";
import { ShortText } from "@/components/form-runner/fields/ShortText";
import { SingleChoice } from "@/components/form-runner/fields/SingleChoice";
import { Statement } from "@/components/form-runner/fields/Statement";
import { ThankYou } from "@/components/form-runner/fields/ThankYou";
import type { FieldProps } from "@/components/form-runner/fields/types";

interface Props extends FieldProps {
  redirectUrl?: string;
}

export function StepRenderer(props: Props) {
  const { step } = props;

  switch (step.type as Step["type"]) {
    case "short_text":
      return <ShortText {...props} />;
    case "email":
      return <Email {...props} />;
    case "single_choice":
      return <SingleChoice {...props} />;
    case "statement":
      return <Statement {...props} />;
    case "thank_you":
      return <ThankYou redirectUrl={props.redirectUrl} />;
    default:
      return <NotImplemented {...props} />;
  }
}
