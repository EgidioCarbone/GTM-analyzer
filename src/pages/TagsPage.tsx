// src/pages/TagsPage.tsx

import React from "react";
import { useContainer } from "../context/ContainerContext";
import ItemList from "../components/ItemList";

export default function TagsPage() {
  const { container } = useContainer();

  if (!container) {
    return (
      <p className="text-gray-500 text-sm">
        Carica prima un JSON nella sezione Dashboard.
      </p>
    );
  }

  return (
    <ItemList
      items={container.tag ?? []}
      type="tag"
    />
  );
}