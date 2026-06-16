"use client";

import { useState } from "react";
import {
  CustomerSearchSelect,
  type CustomerSelectOption,
} from "@/components/shared/customer-search-select";

type CustomerFilterFieldProps = {
  initialCustomerId?: string;
  initialOption?: CustomerSelectOption | null;
};

export function CustomerFilterField({
  initialCustomerId,
  initialOption,
}: CustomerFilterFieldProps) {
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");

  return (
    <>
      <input type="hidden" name="customerId" value={customerId} />
      <CustomerSearchSelect
        value={customerId}
        onValueChange={setCustomerId}
        initialOption={initialOption}
        label="Client"
      />
    </>
  );
}
