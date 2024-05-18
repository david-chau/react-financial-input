import React, {BaseSyntheticEvent, useState} from 'react';
import {Nullable} from "src/types";
import {InputType} from "src/enums";

interface FinancialInputOptions {
    scale?: number;
}

interface FinancialInputProps {
    value: Nullable<number>;
    onChange: (value: Nullable<number>) => void;
    options?: FinancialInputOptions
}
export const FinancialInput: React.FC<FinancialInputProps> = (props: FinancialInputProps) => {
    const { value, onChange } = props;

    const defaultDisplayValue = value !== null && value !== undefined ? String(value) : '';

    const [ displayValue, setDisplayValue ] = useState<string>(defaultDisplayValue);

    const handleInput = (event: BaseSyntheticEvent<InputEvent>) => {
        const { nativeEvent, target } = event;
        const { inputType } = nativeEvent;
        const { value: targetValue } = target;

        console.log("handleInput", {inputType, targetValue})

        switch (inputType) {
            case InputType.INSERT_TEXT:
            case InputType.INSERT_FROM_PASTE:
            case InputType.DELETE_BY_CUT:
            case InputType.DELETE_CONTENT_BACKWARD:
            case InputType.DELETE_CONTENT_FORWARD:
                setDisplayValue(targetValue);
                onChange(targetValue)
                break;
            default:
                console.log(`FinancialInput - Unsupported input type: ${inputType}`);
        }
    }

    return <input value={displayValue} onInput={handleInput}/>;
}