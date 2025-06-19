import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    //validation - not empty
    // check if user already exists
    //check for images ,check for avatar
    //upload them to cloudinary , avatar
    // create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creatation 
    //return response 

    console.log("req.files:", req.files);
    console.log("req.body:", req.body);
    const { fullName, email, username, password } = req.body;
    console.log("email", email)

    if (fullName === "") {
        throw new ApiError(400, "fullname is required")
    }
    if (email === "") {
        throw new ApiError(400, "email is required")
    }
    if (username === "") {
        throw new ApiError(400, "username is required")
    }

    if (password === "") {
        throw new ApiError(400, "Password is required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }] // this method check for both username and email
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exits")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }


    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    console.log("Uploading avatar from path:", avatarLocalPath);
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    // console.log("Cloudinary upload result for avatar:", avatar);

    if (!avatar?.url) {
        throw new ApiError(500, "Failed to upload avatar to Cloudinary");
    }

    let coverImage = null;
    if (coverImageLocalPath) {
        coverImage = await uploadOnCloudinary(coverImageLocalPath);
    }



    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

})


const generateAccessAndRefreshTokens = async(userID) => {
    try {
        const user = await User.findById(userID)
       const accessToken =  user.generateAccessToken()
       const refreshToken = user.generateRefreshToken()

       user.refreshToken = refreshToken
       await user.save({validateBeforeSave : false})

      return {accessToken,refreshToken}


    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and accessToken")
    }
}

const loginUser = asyncHandler(async(req,res)=>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and refresh token
    //send cookies 



    const {email,username,password} = req.body
    
    if(!username || !email) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })
    if(!user){
        throw new ApiError(400,"User not exits")
    }

    const isPasswordValid =  await  user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credientials")
    }


   const {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id)

   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

   const options = {
    httpOnly : true,
    secure:true
   }

   return res
   .status(200)
   .cookie("AccessToken",accessToken , options)
   .cookie("refreshToken",refreshToken,options)
   .json(
    new ApiResponse(
        200,
        {
            user:loggedInUser,accessToken,refreshToken
        },
        "User logged in Successfully"
    )
   )

    
})


const logoutUser = asyncHandler(async(req,res)=>{
    //clear cookies 
    //clear acessToken and refreshToken

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new : true
        }
    )


    const options = {
    httpOnly : true,
    secure:true
   }

   return res
   .status(200)
   .clearCookie("accessToken" , options)
   .clearCookie("refreshToken" , options)
   .json(new ApiResponse(200 ,{} , "User logged Out"))


})

export { 
    registerUser ,
    loginUser,
    logoutUser
}
