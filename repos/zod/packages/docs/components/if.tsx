"use client";

export function If(props: { groupId: string; values: string[]; children: any }) {
  if (typeof window === "undefined") return null;
  // read key from localstorage
  const value = window.localStorage.getItem(props.groupId);
  // if key is in values, return children
  if (value && props.values.includes(value)) {
    return props.children;
  }
}
