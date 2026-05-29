import { loginClient } from './src/app/actions/auth';
async function test() {
  const formData = new FormData();
  formData.append('phone', '0000000');
  formData.append('password', '1234');
  const res = await loginClient(formData);
  console.log(res);
}
test();
