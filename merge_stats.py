import pandas as pd

# 1. Load the data
# Make sure 'green_room_training_data.csv' is the name of your final merged file
df = pd.read_csv('master.csv')

# 2. Drop the 'ARC' column
# axis=1 tells pandas to look for a column (not a row) named 'ARC'
df = df.drop('ARC', axis=1)

# 3. Rename the defensive column
# We use a dictionary where the 'key' is the old name and the 'value' is the new name
df = df.rename(columns={'Defensive Archetype': 'Defensive Role'})

# 4. Save the cleaned dataset
# This overwrites the file with your newly cleaned data
df.to_csv('green_room_training_data.csv', index=False)

print("Data cleaned! 'ARC' column removed and 'Defensive Archetype' renamed to 'Defensive Role'.")