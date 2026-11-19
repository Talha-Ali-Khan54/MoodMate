import math

def calculate_distance(point1, point2, width, height):

    x1 = point1.x * width
    y1 = point1.y * height

    x2 = point2.x * width
    y2 = point2.y * height

    distance = math.sqrt(
        (x2 - x1) ** 2 + (y2 - y1) ** 2
    )

    return distance


# Extract numerical features from facial landmarks
def extract_features(landmarks, image_shape):

    height, width = image_shape[:2]

    # Calculate face width for normalization
    face_width = calculate_distance(
        landmarks[234],
        landmarks[454],
        width,
        height
    )

    if face_width == 0:
        raise ValueError("Invalid face width")

    # 1. Mouth width
    mouth_width = calculate_distance(
        landmarks[61],
        landmarks[291],
        width,
        height
    ) / face_width

    # 2. Mouth opening
    mouth_opening = calculate_distance(
        landmarks[13],
        landmarks[14],
        width,
        height
    ) / face_width

    # 3. Left eye opening
    left_eye_opening = calculate_distance(
        landmarks[159],
        landmarks[145],
        width,
        height
    ) / face_width

    # 4. Right eye opening
    right_eye_opening = calculate_distance(
        landmarks[386],
        landmarks[374],
        width,
        height
    ) / face_width

    # 5. Left eyebrow-to-eye distance
    left_brow_eye = calculate_distance(
        landmarks[105],
        landmarks[159],
        width,
        height
    ) / face_width

    # 6. Right eyebrow-to-eye distance
    right_brow_eye = calculate_distance(
        landmarks[334],
        landmarks[386],
        width,
        height
    ) / face_width

    # 7. Mouth corner lift
    mouth_center_y = (
        (landmarks[13].y + landmarks[14].y) / 2
    ) * height

    mouth_corners_y = (
        (landmarks[61].y + landmarks[291].y) / 2
    ) * height

    corner_lift = (
        mouth_center_y - mouth_corners_y
    ) / face_width

    return {
        "mouth_width": mouth_width,
        "mouth_opening": mouth_opening,
        "left_eye_opening": left_eye_opening,
        "right_eye_opening": right_eye_opening,
        "left_brow_eye": left_brow_eye,
        "right_brow_eye": right_brow_eye,
        "corner_lift": corner_lift
    }