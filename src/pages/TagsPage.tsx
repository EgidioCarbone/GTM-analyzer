import React from "react";
import { useContainer } from "../context/ContainerContext";
import TagSection from "../components/TagSection";

export default function TagsPage() {
  const { container, setContainer } = useContainer();

  if (!container) {
    return (
      <p className="text-gray-500 text-sm">
        Carica prima un JSON nella sezione Dashboard.
      </p>
    );
  }

  return (
    <TagSection
      tags={container.tag ?? []}
      triggers={container.trigger ?? []}
      updateTags={(newTags) =>
        setContainer({ ...container, tag: newTags })
      }
    />
  );
}