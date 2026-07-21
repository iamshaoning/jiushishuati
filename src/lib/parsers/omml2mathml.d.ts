declare module 'omml2mathml' {
  /**
   * 将 OMML（Office MathML）元素转为标准 MathML 元素
   * 输入：m:oMath 或 m:oMathPara DOM 元素
   * 输出：MathML <math> DOM 元素
   */
  export default function omml2mathml(element: Element): Element;
}
