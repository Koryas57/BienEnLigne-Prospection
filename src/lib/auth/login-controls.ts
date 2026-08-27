export function loginControlState(configurationDisabled: boolean, submitting: boolean) {
  return {
    fieldsDisabled: configurationDisabled,
    fieldsReadOnly: submitting && !configurationDisabled,
    submitDisabled: configurationDisabled || submitting,
  };
}
