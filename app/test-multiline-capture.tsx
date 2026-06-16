export function TestMultilineCapture() {
  const onCheckout = () => {
    posthog.capture(
      'checkout_demo'
    );
  };
  return null;
}
