import { render } from '@testing-library/react';
import { FinancialInput } from '../../index.ts';

describe('<FinancialInput/>', () => {
  it('default renders correctly', () => {
    const result = render(<FinancialInput />);
    expect(result).toMatchSnapshot();
  });
});
