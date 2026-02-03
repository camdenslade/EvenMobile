//********************************************************************
//
// usePhotoDrag Hook
//
// Custom hook for implementing drag-to-reorder functionality for photos.
// Manages pan responders, animated positions, and slot measurements for
// Tinder-style photo reordering. Swaps photos when dragging over another
// photo slot.
//
// Return Value
// ------------
// Object    Object containing panResponders, drag state, and measureSlot function
//
// Value Parameters
// ----------------
// photos            (string|null)[]                    Current photos array
// setPhotos         function                            Photos setter function
// setDraggingIndex  function                            Dragging index setter
// setHoverIndex     function                            Hover index setter
//
// Reference Parameters
// --------------------
// None
//
// Local State
// -----------
// dragPositions     useRef<{ [key: number]: Animated.ValueXY }>    Animated position values
// slotPositions     useRef<{ [key: number]: { x: number; y: number } }>    Slot position cache
// isDraggingRef     useRef<boolean>                                 Whether drag is active
// photosRef         useRef<(string|null)[]>                         Photos array ref
// panResponders     useRef<{ [key: number]: any }>                  Pan responder cache
//
// Side Effects
// ------------
// Creates animated values and pan responders
// Updates photo array order on drag swap
//
//*******************************************************************

import { useEffect, useRef } from "react";
import { Animated, PanResponder } from "react-native";

const dragThreshold = 10;

export function usePhotoDrag(
  photos: (string | null)[],
  setPhotos: React.Dispatch<React.SetStateAction<(string | null)[]>>,
  setDraggingIndex: (index: number | null) => void,
  setHoverIndex: (index: number | null) => void
) {
  const dragPositions = useRef<{ [key: number]: Animated.ValueXY }>({});
  const slotPositions = useRef<{ [key: number]: { x: number; y: number } }>({});
  const isDraggingRef = useRef<boolean>(false);
  const photosRef = useRef(photos);
  const panResponders = useRef<{ [key: number]: any }>({});
  const hoverIndexRef = useRef<number | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    photos.forEach((_, index) => {
      if (!dragPositions.current[index]) {
        dragPositions.current[index] = new Animated.ValueXY();
      }
    });
  }, [photos.length]);

  const measureSlot = (index: number, x: number, y: number) => {
    slotPositions.current[index] = { x, y };
  };

  function createPanResponder(index: number) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > dragThreshold || Math.abs(gesture.dy) > dragThreshold;
      },
      onPanResponderGrant: () => {
        isDraggingRef.current = false;
        setDraggingIndex(index);
        dragPositions.current[index].setOffset({ x: 0, y: 0 });
        dragPositions.current[index].setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gesture) => {
        if (Math.abs(gesture.dx) > dragThreshold || Math.abs(gesture.dy) > dragThreshold) {
          isDraggingRef.current = true;
          dragPositions.current[index].setValue({ x: gesture.dx, y: gesture.dy });

          const currentSlot = slotPositions.current[index];
          if (currentSlot) {
            const dragX = currentSlot.x + gesture.dx;
            const dragY = currentSlot.y + gesture.dy;

            let newHoverIndex: number | null = null;
            const slotSize = 100;

            for (let i = 0; i < 6; i++) {
              const slot = slotPositions.current[i];
              if (slot && i !== index && photosRef.current[i]) {
                const slotCenterX = slot.x + slotSize / 2;
                const slotCenterY = slot.y + slotSize / 2;
                const distance = Math.sqrt(
                  Math.pow(dragX - slotCenterX, 2) + Math.pow(dragY - slotCenterY, 2)
                );
                if (distance < slotSize * 0.7) {
                  newHoverIndex = i;
                  break;
                }
              }
            }

            if (newHoverIndex !== hoverIndexRef.current && newHoverIndex !== null) {
              hoverIndexRef.current = newHoverIndex;
              setHoverIndex(newHoverIndex);

              if (photosRef.current[newHoverIndex]) {
                setPhotos((prev) => {
                  const updated = [...prev];
                  [updated[index], updated[newHoverIndex!]] = [
                    updated[newHoverIndex!],
                    updated[index],
                  ];
                  return updated;
                });
                setHoverIndex(null);
                hoverIndexRef.current = null;
                dragPositions.current[index].setValue({ x: 0, y: 0 });
              }
            }
          }
        }
      },
      onPanResponderRelease: () => {
        dragPositions.current[index].flattenOffset();
        Animated.spring(dragPositions.current[index], {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start(() => {
          dragPositions.current[index].setOffset({ x: 0, y: 0 });
          dragPositions.current[index].setValue({ x: 0, y: 0 });
        });

        setDraggingIndex(null);
        setHoverIndex(null);
        hoverIndexRef.current = null;

        setTimeout(() => {
          isDraggingRef.current = false;
        }, 150);
      },
    });
  }

  useEffect(() => {
    for (let i = 0; i < 6; i++) {
      if (photos[i]) {
        panResponders.current[i] = createPanResponder(i);
      } else {
        delete panResponders.current[i];
      }
    }
  }, [photos]);

  return {
    panResponders: panResponders.current,
    dragPositions: dragPositions.current,
    measureSlot,
    isDraggingRef,
  };
}

