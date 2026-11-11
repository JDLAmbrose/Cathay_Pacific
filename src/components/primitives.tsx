import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type InputHTMLAttributes,
  type OptionHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import styles from "./site.module.css";
import layout from "./layoutUtilities.module.css";

export function cx(...names: (string | undefined)[]) {
  return names
    .flatMap((name) => name?.split(/\s+/).filter(Boolean) ?? [])
    .map((name) => styles[name] || layout[name] || name)
    .join(" ");
}
export function cssVars(values: Record<string, string | number>) {
  return values as CSSProperties;
}
const assets = import.meta.glob<string>("/assets/*.{svg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
export function asset(filename: string) {
  return assets["/" + filename.replace(/^\//, "")] ?? filename;
}
export function keyed(children: ReactNode[]) {
  return children.map((child, index) =>
    isValidElement(child) && child.key === null
      ? cloneElement(child, { key: index })
      : child,
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input onChange={() => {}} {...props} />;
}

type OptionProps = OptionHTMLAttributes<HTMLOptionElement>;
export function Option({ selected: _selected, ...props }: OptionProps) {
  return <option {...props} />;
}

function selectedValue(children: ReactNode): OptionProps["value"] {
  for (const item of Children.toArray(children)) {
    if (!isValidElement<OptionProps>(item)) continue;
    if (item.type === Option && item.props.selected) return item.props.value;
    if (item.type !== Option) {
      const value = selectedValue(item.props.children);
      if (value !== undefined) return value;
    }
  }
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select value={selectedValue(children)} onChange={() => {}} {...props}>
      {children}
    </select>
  );
}
