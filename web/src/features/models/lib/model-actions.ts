import { deleteModel, updateModelStatus } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'

/**
 * Toggle model status (enable/disable)
 */
export async function toggleModelStatus(
  id: number,
  currentStatus: number
): Promise<{ success: boolean; message: string }> {
  try {
    const newStatus = currentStatus === 1 ? 0 : 1
    const result = await updateModelStatus(id, newStatus)

    if (result.success) {
      return {
        success: true,
        message:
          newStatus === 1
            ? SUCCESS_MESSAGES.MODEL_ENABLED
            : SUCCESS_MESSAGES.MODEL_DISABLED,
      }
    }

    return {
      success: false,
      message: result.message || ERROR_MESSAGES.STATUS_UPDATE_FAILED,
    }
  } catch (error) {
    return {
      success: false,
      message: ERROR_MESSAGES.STATUS_UPDATE_FAILED,
    }
  }
}

/**
 * Delete a single model
 */
export async function deleteSingleModel(
  id: number
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await deleteModel(id)

    if (result.success) {
      return {
        success: true,
        message: SUCCESS_MESSAGES.MODEL_DELETED,
      }
    }

    return {
      success: false,
      message: result.message || ERROR_MESSAGES.DELETE_FAILED,
    }
  } catch (error) {
    return {
      success: false,
      message: ERROR_MESSAGES.DELETE_FAILED,
    }
  }
}
