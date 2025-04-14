export function validateEmail(email) {
  const emailPattern = /^[A-Za-z0-9]+@[A-Za-z0-9]+.[A-Za-z0-9]+$/;
  return emailPattern.test(email);
}
