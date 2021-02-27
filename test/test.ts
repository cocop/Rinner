import { Rinner } from "../src/mods.ts";

console.log("oktest");
const ok_r = await Rinner
  .try(() => {
    return 2143;
  })
  .countingRetry(10, 50)
  .confirmResult();
console.log("  " + (ok_r === 2143 ? "ok" : "err"));

console.log("errtest");
let err_test_log = "";
const _ = await Rinner
  .try(() => {
    err_test_log += "t";
    throw new Error();
  })
  .countingRetry(4, 10, () => {
    err_test_log += "r";
  })
  .catch((self) => {
    err_test_log += "e";
  })
  .confirm();

console.log("  " + (err_test_log === "trtrtrtrte" ? "ok" : "err"));
