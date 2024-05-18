import { render } from '@testing-library/react';
import { FinancialInput } from 'src/components';

describe('<FinancialInput/>', () => {
  it('default renders correctly', () => {
    const result = render(<FinancialInput />);
    expect(result).toMatchSnapshot();
  });
});
