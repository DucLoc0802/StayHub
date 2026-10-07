export const vietnamPhonePattern = /^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/;
export function normalizeVietnamPhone(value: string) {
  return value.replace(/[\s.-]/g, '').replace(/^\+84/, '0');
}
export function profileComplete(user: {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
}) {
  return (
    user.fullName.trim().length >= 2 &&
    !!user.email &&
    vietnamPhonePattern.test(user.phoneNumber ?? '')
  );
}
