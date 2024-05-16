import React from 'react';

interface FinancialInputProps {
    label?: string;
}
export const FinancialInput: React.FC<FinancialInputProps> = (props: FinancialInputProps) => {
    const {label} = props;

    return <div>{label}</div>;
}

export default FinancialInput