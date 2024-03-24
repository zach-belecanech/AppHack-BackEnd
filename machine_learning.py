import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import pairwise_distances, jaccard_score
from flask import Flask, jsonify
import requests

app = Flask(__name__)

# Define the list of all possible classes
all_classes = [
    "DISCRETE MATHEMATICS", "OVERVIEW OF COMPUTER SCIENCE", "COMPUTER SCIENCE I", "STEM SEMINAR", "INTRO TO SCIENTIFIC PROGRAM", "COMPUTER SCIENCE II", "INTRO TO COMPUTER SYSTEMS", "INTRO THEORETICAL CMP SCI", "COMPUTATIONAL REASONING", "DATABASE", "DATA COLLECTION & VISUALIZATION", "DATA STRUCTURES", "COMPUTER SYSTEMS I",
     "COMPUTER SYSTEMS II", "PROGRAMMING LANGUAGES", "INDEPENDENT STUDY", "FULL STACK DEVELOPMENT", "COMPETITIVE PROGRAMMING", "VISUAL ANALYTICS", "SOFTWARE ENGINEERING", "SENIOR SEMINAR", "SERVER-SIDE WEB PROGRAMMING", "COMPUTER GRAPHICS", "OPERATING SYSTEMS", "CAPSTONE PROJECT", "INTERNSHIP", "SEM IN COMPUTER SCIENCE", "ADV COMPUTER GRAPHICS", "INDEPENDENT STUDY", "OPERATING SYSTEMS", "EMBEDDED SYSTEMS", "TOPICS IN DATA SCI & VIS COMP", "TOPICS IN THEORETICAL COMP SCI", "TOPICS IN WEB & MOBILE COMPUT", "PROJECT", "THESIS PREPARATION"
]


def time_to_minutes(time_str):
    """Convert a time string 'HH:MM' to minutes."""
    hours, minutes = map(int, time_str.split(':'))
    return hours * 60 + minutes


def calculate_overlap(interval1, interval2):
    """Calculate the overlap in minutes between two time intervals."""
    start1, end1 = map(time_to_minutes, interval1)
    start2, end2 = map(time_to_minutes, interval2)
    return max(0, min(end1, end2) - max(start1, start2))


def calculate_free_time_overlap(free_time1, free_time2):
    """Calculate the total overlap in minutes between two free time lists."""
    total_overlap = 0
    for interval1 in free_time1:
        for interval2 in free_time2:
            total_overlap += calculate_overlap(interval1, interval2)
    return total_overlap / 60  # Convert minutes to hours


def calculate_similarity(student1, student2):
    # Handle edge cases where students have no classes or no free time
    if not any(student1['classes']) or not any(student2['classes']):
        class_similarity = 0
    else:
        class_similarity = jaccard_score(student1['classes'], student2['classes'], zero_division=0)

    if not student1['free_time'] or not student2['free_time']:
        free_time_similarity = 0
    else:
        free_time_similarity = calculate_free_time_overlap(student1['free_time'], student2['free_time'])

    return 0.4 * class_similarity + 0.6 * free_time_similarity  # Adjust weights as needed


def custom_distance_metric(features1, features2):
    # Extract class features and total free time
    class_features1, total_free_time1 = features1[:-1], features1[-1]
    class_features2, total_free_time2 = features2[:-1], features2[-1]

    # Calculate class similarity using Jaccard score
    class_similarity = jaccard_score(class_features1, class_features2)

    # Calculate free time similarity (assuming max possible overlap is 24 hours)
    max_possible_overlap = 24
    free_time_similarity = min(total_free_time1, total_free_time2) / max_possible_overlap

    # Combine class similarity and free time similarity into a custom distance metric
    return 1 - (0.4 * class_similarity + 0.6 * free_time_similarity)


def free_time_to_binary_vector(free_time):
    """Convert a list of free time intervals to a binary vector."""
    binary_vector = np.zeros(24 * 60)  # Assuming a 24-hour day with minute granularity
    for start, end in free_time:
        start_minutes = time_to_minutes(start)
        end_minutes = time_to_minutes(end)
        binary_vector[start_minutes:end_minutes] = 1
    return binary_vector

def process_student_data(student):
    """Process the student data to extract class features and free time."""
    # Handle the 'availability' field
    if student['availability'] is None:
        free_time = []
    else:
        # Convert the availability string to a list of tuples
        free_time = [tuple(time.strip() for time in interval.split(',')) for interval in student['availability'][1:-1].split('), (')]

    return free_time

def encode_classes(classes):
    """Encode the list of classes into a binary vector."""
    binary_vector = [0] * 36
    if classes is not None:
        for cls in classes.split(', '):
            if cls in all_classes:
                binary_vector[all_classes.index(cls)] = 1
    return binary_vector


@app.route('/cluster_students', methods=['POST'])
def cluster_students():
     # Make an API call to get the student data
    api_url = "http://34.227.51.137:3000/getStudentDetails"
    response = requests.get(api_url)
    students = response.json()

    # Process the student data and perform clustering
    numerical_features = []
    for student in students:
        class_features = encode_classes(student['classes'])
        free_time = process_student_data(student)  # Process the 'availability' field
        total_free_time = sum((time_to_minutes(end) - time_to_minutes(start)) for start, end in free_time) / 60
        numerical_features.append(class_features + [total_free_time])

    numerical_features = np.array(numerical_features)
    distance_matrix = pairwise_distances(numerical_features, metric=custom_distance_metric)
    clustering = AgglomerativeClustering(n_clusters=None, distance_threshold=0.5, linkage='complete')
    clustering.fit(distance_matrix)

    # max_group_size = 4
    # groups = []
    # for cluster_label in np.unique(clustering.labels_):
    #     cluster_indices = np.where(clustering.labels_ == cluster_label)[0]
    #     if len(cluster_indices) <= max_group_size:
    #         groups.append([students[i] for i in cluster_indices])
    #     else:
    #         for i in range(0, len(cluster_indices), max_group_size):
    #             groups.append(
    #                 [students[cluster_indices[j]] for j in range(i, min(i + max_group_size, len(cluster_indices)))])

    # Group students based on clustering labels
    groups = []
    for cluster_label in np.unique(clustering.labels_):
        cluster_indices = np.where(clustering.labels_ == cluster_label)[0]
        groups.append([students[i] for i in cluster_indices])
    # Return the groups as JSON
    return jsonify(groups)
