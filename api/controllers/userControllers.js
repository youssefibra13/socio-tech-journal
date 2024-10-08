const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const {v4: uuid} = require('uuid');


const User = require('../models/userModel');
const HttpError = require('../models/errorModel');



/* Resister a new user */

// POST: /api/users/register & UNPROTECTED
const registerUser = async (req, res, next) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        if (!name || !email || !password || !confirmPassword) {
            return next(new HttpError('Please fill all fields', 422));
        }

        const newEmail = email.toLowerCase();
        const existingUser = await User.findOne({ email: newEmail });

        if (existingUser) {
            return next(new HttpError('Email already exists, please login', 422));
        }

        if (password.length < 8) {
            return next(new HttpError('Password must be at least 8 characters', 422));    
        }

        if (password !== confirmPassword) {
            return next(new HttpError('Passwords do not match', 422));
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await User.create({ name, email: newEmail, password: hashedPassword });

        console.log('New user registered:', newUser);  // Debug log
        res.status(201).json(`New User ${newUser.email} Registered successfully`);
    } catch (error) {
        
        return next(new HttpError('Registration failed, please try again', 422));
    }
}


/* Login a user */

// POST: /api/users/login & UNPROTECTED
const loginUser = async (req, res, next) => {
    try {

        const { email, password } = req.body;
        if (!email || !password) {
            return next(new HttpError('Please fill all fields', 422));
        }

        const newEmail = email.toLowerCase();

        const user = await User.findOne({ email: newEmail });
        if (!user) {
            return next(new HttpError('Invalid credentials, please try again', 422));
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return next(new HttpError('Invalid credentials, please try again', 422));
        }

        const {_id: id, name} = user;
        const token = jwt.sign({ id, name }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({ id, name, token });
    } catch (error) {
        return next(new HttpError('Login failed, please check your information', 422));
    }
    
}

/* USER PROFILE */

//Get: /api/users/:id & PROTECTED
const getUser = async (req, res, next) => {
    try {

        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return next(new HttpError('User not found', 404));
        }
        res.status(200).json(user);
    } catch (error) {
        return next(new HttpError('User not found', 404));
    }
}

/* UPDATE USER PROFILE image*/

//POST: /api/users/change-image & PROTECTED
const changePicture = async (req, res, next) => {
    try {
        if (!req.files.image) {
            return next(new HttpError('Please upload a image', 422));
        }
        
        //find user from our data base
        const user = await User.findById(req.user.id);
        // delte image if it exists
        // if (user.image) {
        //     fs.unlink(path.join(__dirname,  `../uploads/${user.image}`), (error) => {
        //         if (error) {
        //             return next(new HttpError('Error deleting image', 500));
        //         }
        //     });
        // }
            if (user.image) {
                fs.unlink(path.join(__dirname, '..', 'uploads', user.image), (error) => {
                    if (error) {
                        return next(new HttpError('Error deleting image', 422));
                    }
                });
            }

        const { image } = req.files;
        //check the size of the image
        if (image.size > 500000) {
            return next(new HttpError('image size should not exceed 500kb', 422));
        }

        let fileName = image.name;
        
        let splitName = fileName.split('.');
        let ext = splitName[0] + uuid() + '.' + splitName[splitName.length - 1];

        image.mv(path.join(__dirname, '..', 'uploads', ext), async (error) => {
            if (error) {
                return next(new HttpError('Error uploading image', 422));
            }
        });

        const updatedimage = await User.findByIdAndUpdate(req.user.id, { image: ext }, { new: true });
        if(!updatedimage) {
            return next(new HttpError('Error updating image', 422));
        }
        res.status(200).json(updatedimage);

    } catch (error) {
        return next(new HttpError(error));
    }
}

/* UPDATE USER PROFILE Details*/

//POST: /api/users/edit-user & PROTECTED
const editUser = async (req, res, next) => {
    try {
        const { name, email, currentPassword, newPassword, confirmNewPassword } = req.body;
        if (!name || !email || !currentPassword || !newPassword || !confirmNewPassword) {
            return next(new HttpError('Please fill all fields', 422));
        }

        // get user from database
        const user = await User.findById(req.user.id);
        if (!user) {
            return next(new HttpError('User not found', 403));
        }

        //make sure new email is not in use
        const emailExist = await User.findOne({ email });
        // we want to update other details without changing the email (which is a unique because we are using it as an identifier)
        if (emailExist && emailExist._id !== req.user.id) {
            return next(new HttpError('Email already in use', 422));
        }

        //check if current password is correct. Check if it matched the db password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return next(new HttpError('Invalid password', 422));
        }

        if (newPassword !== confirmNewPassword) {
            return next(new HttpError('New Passwords do not match', 422));
        }

        // Encrypt the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        //update user details
        const updatedUser = await User.findByIdAndUpdate(req.user.id, { name, email, password: hashedPassword }, { new: true });
        res.status(200).json(updatedUser);
    } catch (error) {
        return next(new HttpError(error));
    }

}


/* GET ALL USERS */

//POST: /api/users/authors & PROTECTED
const getAuthors = async (req, res, next) => {
    try {
        const authors = await User.find().select('-password');
        res.status(200).json(authors);

    } catch (error) {
        return next(new HttpError('No authors found', 404));
    }
}

module.exports = {registerUser, loginUser, getUser, changePicture, editUser, getAuthors};
