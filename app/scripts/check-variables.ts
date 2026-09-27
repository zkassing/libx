import assert from "node:assert";
import {
  extractVariableKeys,
  renderTemplate,
  missingVariables,
  resolveVariableValues,
  findUnfilledRequired,
  parseOptions,
  parseVariableType,
} from "../src/server/teaching/variables";
import type { WorkflowVariable } from "../src/lib/variableTypes";
import { validateVariableInput } from "../src/server/teaching/validateVariable";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, name);
  passed++;
  console.log("PASS ", name);
}

/* extractVariableKeys */
ok("提取单个 key", JSON.stringify(extractVariableKeys("{{subject}}")) === '["subject"]');
ok("提取并去重", JSON.stringify(extractVariableKeys("{{a}}-{{b}}-{{a}}")) === '["a","b"]');
ok("容忍空格", JSON.stringify(extractVariableKeys("{{ a }}")) === '["a"]');
ok("无变量返回空", extractVariableKeys("plain text").length === 0);

/* renderTemplate */
ok("基本替换", renderTemplate("画面：{{subject}}", { subject: "猫" }) === "画面：猫");
ok("多次出现都替换", renderTemplate("{{x}}{{x}}", { x: "1" }) === "11");
ok("空格占位也替换", renderTemplate("{{ x }}", { x: "y" }) === "y");
ok("缺失默认保留", renderTemplate("{{a}}", {}) === "{{a}}");
ok("缺失可置空", renderTemplate("{{a}}", {}, { missing: "empty" }) === "");
ok("空串视为缺失", renderTemplate("{{a}}", { a: "" }) === "{{a}}");
ok("其它文本不动", renderTemplate("无占位", { a: "x" }) === "无占位");
ok("原样不转义", renderTemplate("{{a}}", { a: "<b>" }) === "<b>");

/* missingVariables */
ok("漏填检测", JSON.stringify(missingVariables("{{a}}{{b}}", { a: "1" })) === '["b"]');
ok("空串算漏填", JSON.stringify(missingVariables("{{a}}", { a: "" })) === '["a"]');

/* resolveVariableValues */
const defs: WorkflowVariable[] = [
  { id: "1", workflowId: "w", key: "a", label: "A", type: "text", default: "da", options: [], required: false, source: "teacher" },
  { id: "2", workflowId: "w", key: "b", label: "B", type: "text", default: "db", options: [], required: false, source: "student" },
  { id: "3", workflowId: "w", key: "c", label: "C", type: "text", default: null, options: [], required: false, source: "student" },
];
const resolved = resolveVariableValues(defs, { b: "sb" });
ok("学生值覆盖默认", resolved.b === "sb");
ok("未填回退默认", resolved.a === "da");
ok("无默认则不出现", resolved.c === undefined);

/* findUnfilledRequired */
const reqDefs: WorkflowVariable[] = [
  { id: "1", workflowId: "w", key: "a", label: "A", type: "text", default: null, options: [], required: true, source: "student" },
  { id: "2", workflowId: "w", key: "b", label: "B", type: "text", default: "x", options: [], required: true, source: "student" },
];
const unfilled = findUnfilledRequired(reqDefs, {});
ok("必填无值被拦", unfilled.length === 1 && unfilled[0].key === "a");
ok("有默认不算缺", findUnfilledRequired(reqDefs, { a: "v" }).length === 0);

/* 解析辅助 */
ok("parseOptions 正常数组", JSON.stringify(parseOptions('["a","b"]')) === '["a","b"]');
ok("parseOptions 非法返回空", parseOptions("notjson").length === 0);
ok("parseOptions null 返回空", parseOptions(null).length === 0);
ok("parseVariableType 合法", parseVariableType("select") === "select");
ok("parseVariableType 非法兜底 text", parseVariableType("weird") === "text");

/* validateVariableInput */
const v1 = validateVariableInput({
  key: "subject", label: "主体", type: "text", source: "student", required: true,
});
ok("合法输入无错", v1.errors && Object.keys(v1.errors).length === 0 && v1.input?.key === "subject");
ok("非对象被拦", validateVariableInput("x").errors._ !== undefined);
ok("空 key 被拦", validateVariableInput({ key: "  ", label: "l" }).errors.key !== undefined);
ok("非法 key 字符被拦", validateVariableInput({ key: "1bad", label: "l" }).errors.key !== undefined);
ok("空 label 被拦", validateVariableInput({ key: "a", label: "" }).errors.label !== undefined);
ok("非法 type 被拦", validateVariableInput({ key: "a", label: "l", type: "xx" }).errors.type !== undefined);
ok("非法 source 被拦", validateVariableInput({ key: "a", label: "l", source: "xx" }).errors.source !== undefined);
ok("select 无选项被拦", validateVariableInput({ key: "a", label: "l", type: "select", options: [] }).errors.options !== undefined);
ok("select 有选项通过", (() => {
  const r = validateVariableInput({ key: "a", label: "l", type: "select", options: ["x", " y "] });
  return (r.input?.options ?? []).join(",") === "x,y";
})());
ok("默认值归一为字符串", validateVariableInput({ key: "a", label: "l", default: 123 }).input?.default === "123");
ok("null 默认值归一", validateVariableInput({ key: "a", label: "l", default: null }).input?.default === null);
ok("默认 type/text、source/student", (() => {
  const r = validateVariableInput({ key: "a", label: "l" });
  return r.input?.type === "text" && r.input.source === "student";
})());

console.log(`\n全部通过：${passed} 通过 / 0 失败`);
