/* ------------------------------------------------------------------ */
/* 工作流变量（T3.5）领域类型                                            */
/* ------------------------------------------------------------------ */

export type VariableType = "text" | "number" | "select" | "asset";

/** 变量由谁提供值：teacher=老师锁定默认值；student=学生引导模式填写 */
export type VariableSource = "teacher" | "student";

export interface WorkflowVariable {
  id: string;
  workflowId: string;
  /** 占位标识，提示词里以 {{key}} 引用 */
  key: string;
  /** 给师生看的名称，如「画面主体」 */
  label: string;
  type: VariableType;
  /** 老师预设默认值 */
  default: string | null;
  /** type=select 时的候选项 */
  options: string[];
  required: boolean;
  source: VariableSource;
}

/** 创建/更新时提交的字段（无 id / 时间戳） */
export type VariableInput = Omit<
  WorkflowVariable,
  "id" | "workflowId" | "options"
> & { options?: string[] };

/** 运行时的变量取值表：key -> 已填值 */
export type VariableValues = Record<string, string>;
