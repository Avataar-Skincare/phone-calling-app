import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage } from "zustand/middleware";

/** AsyncStorage adapter for zustand `persist`. Not for secrets (the session token uses SecureStore). */
export const persistStorage = createJSONStorage(() => AsyncStorage);
