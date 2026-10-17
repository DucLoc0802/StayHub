export function momoConfig() {
  const name = process.env.MOMO_RECEIVER_NAME?.trim();
  const phone = process.env.MOMO_RECEIVER_PHONE?.replace(/[\s-]/g, '');
  const minutes = Number(process.env.MOMO_VERIFICATION_WINDOW_MINUTES ?? 60);
  const available = Boolean(
    name &&
    name.length <= 100 &&
    /^(?:0|\+84)[35789]\d{8}$/.test(phone ?? '') &&
    Number.isInteger(minutes) &&
    minutes >= 5 &&
    minutes <= 1440,
  );
  return {
    available,
    receiverName: available ? name! : null,
    receiverPhone: available ? phone! : null,
    verificationWindowMinutes: available ? minutes : 60,
  };
}
