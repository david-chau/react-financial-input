import { FinancialInput } from 'lib/components';
import { useState } from 'react';
import { NullableOrUndefinable } from 'lib/types';

const ExampleApp = () => {
  const [value, setValue] = useState<NullableOrUndefinable<number>>(undefined);

  return (
    <div>
      <FinancialInput value={value} onChange={setValue} />
    </div>
  );
};

export default ExampleApp;
